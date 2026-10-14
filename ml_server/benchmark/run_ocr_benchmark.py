"""Run the OCR benchmark and log everything needed for the ablation study.

Configurations
  full            A0: the production pipeline, unchanged (layout crop -> cells -> 4 variants -> best)
  full_client     A0c: A0 on the image as the web client sends it (MarkEntry.js compressImage: EXIF orientation
                  applied, fitted within 1920x1920, JPEG quality 0.92). The client step is approximated with
                  Pillow (Lanczos resampling) and is not timed, since it runs in the browser.
  no_layout       A1: production pipeline with the layout crop disabled (cells on the full image)
  direct_ocr      B1: PaddleOCR text detection + the same recogniser on the full image (see baselines.py)
  table_pipeline  B2: PaddleOCR's generic TableRecognitionPipelineV2 (see baselines.py)

For `full` and `no_layout` the production code in app.py runs as is. The three models are wrapped in
thin proxies that record every prediction (layout boxes, cell boxes, and the text and score of every
preprocessing variant of every cell), so the other ablations (A2-A6) can be rebuilt offline by
analyze.py without re-running OCR. Proxy bookkeeping time is excluded from the reported runtimes.

Usage (from ml_server/):
  venv/Scripts/python benchmark/run_ocr_benchmark.py --config full \
      --images ../validation_data/benchmark_images --gt ../validation_data/ground_truth.json \
      --out ../validation_data/ablation_runs/A0_full
"""
import argparse
import contextlib
import hashlib
import json
import os
import platform
import re
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.dirname(HERE)
sys.path.insert(0, ML_DIR)

import app as ocr_app  # noqa: E402  (production module, used unchanged)
from paddleocr import LayoutDetection, TableCellsDetection, TextRecognition  # noqa: E402

PRODUCTION_MODELS = ["PP-DocLayout_plus-L", "RT-DETR-L_wired_table_cell_det", "en_PP-OCRv5_mobile_rec"]
_VARIANT_RE = re.compile(r"cell_(\d+)_ver(\d+)\.png$")
CLIENT_MAX_SIDE = 1920
CLIENT_JPEG_QUALITY = 92


def client_preprocess(src, dst):
    """Approximates the web client's compressImage(): orientation applied, fit within 1920x1920, JPEG 0.92."""
    from PIL import Image, ImageOps
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    w, h = im.size
    if w > CLIENT_MAX_SIDE or h > CLIENT_MAX_SIDE:
        r = min(CLIENT_MAX_SIDE / w, CLIENT_MAX_SIDE / h)
        im = im.resize((int(w * r), int(h * r)), Image.LANCZOS)
    im.save(dst, "JPEG", quality=CLIENT_JPEG_QUALITY)
    return im.size


def image_sort_key(name):
    return int(re.search(r"(\d+)", name).group(1))


def to_jsonable(obj):
    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    if hasattr(obj, "tolist"):
        return obj.tolist()
    if hasattr(obj, "item"):
        return obj.item()
    return obj


def result_to_dict(res, tmp_dir):
    """Serialise a paddlex result the same way app.py reads it (save_to_json, then json.load)."""
    path = os.path.join(tmp_dir, "proxy_result.json")
    res.save_to_json(path)
    with open(path, "r") as f:
        return json.load(f)


class Recorder:
    def __init__(self):
        self.tmp_dir = tempfile.mkdtemp(prefix="ocr_bench_")
        self.reset()

    def reset(self):
        self.layout = None
        self.cells = None
        self.variants = {}  # cell index -> list of {ver, text, score} in call order
        self.rec_errors = []
        self.times = {"layout": 0.0, "cells": 0.0, "recognition": 0.0}
        self.rec_calls = 0
        self.overhead = 0.0


class _Proxy:
    def __init__(self, model, recorder, kind):
        self._model = model
        self._rec = recorder
        self._kind = kind

    def __getattr__(self, name):
        return getattr(self._model, name)

    def predict(self, *args, **kwargs):
        t0 = time.perf_counter()
        try:
            out = list(self._model.predict(*args, **kwargs))
        except Exception as e:
            t1 = time.perf_counter()
            self._account(t1 - t0)
            if self._kind == "recognition":
                self._rec.rec_errors.append({"input": str(kwargs.get("input", args[0] if args else "")), "error": repr(e)})
            raise
        t1 = time.perf_counter()
        self._account(t1 - t0)
        self._record(out, args, kwargs)
        self._rec.overhead += time.perf_counter() - t1
        return out

    def _account(self, dt):
        self._rec.times[self._kind] += dt

    def _record(self, out, args, kwargs):
        rec = self._rec
        if self._kind == "layout":
            rec.layout = [result_to_dict(r, rec.tmp_dir) for r in out]
        elif self._kind == "cells":
            rec.cells = [result_to_dict(r, rec.tmp_dir) for r in out]
        else:
            rec.rec_calls += 1
            path = str(kwargs.get("input", args[0] if args else ""))
            m = _VARIANT_RE.search(path.replace("\\", "/"))
            cell_idx, ver = (int(m.group(1)), int(m.group(2))) if m else (-1, -1)
            for r in out:
                rec.variants.setdefault(cell_idx, []).append(
                    {"ver": ver, "text": r.get("rec_text", ""), "score": float(r.get("rec_score", 0.0))}
                )


def load_production_models(recorder):
    ocr_app.layout_model = _Proxy(LayoutDetection(model_name=PRODUCTION_MODELS[0]), recorder, "layout")
    ocr_app.cell_detection_model = _Proxy(TableCellsDetection(model_name=PRODUCTION_MODELS[1]), recorder, "cells")
    ocr_app.text_rec_model = _Proxy(TextRecognition(model_name=PRODUCTION_MODELS[2]), recorder, "recognition")


def run_production(image_path, recorder):
    """A0/A1: call the production functions and return the per-image log."""
    recorder.reset()
    t0 = time.perf_counter()
    result = ocr_app.extract_table_from_image(image_path)
    marks = ocr_app.parse_marks_from_table(result["table_data"])
    t1 = time.perf_counter()

    layout_boxes = recorder.layout[0].get("boxes", []) if recorder.layout else []
    table_box = next((b["coordinate"] for b in layout_boxes if b.get("label") == "table"), None)
    cell_boxes = recorder.cells[0].get("boxes", []) if recorder.cells else []
    cells = []
    for idx, box in enumerate(cell_boxes):
        cells.append({
            "idx": idx,
            "coordinate": box["coordinate"],
            "det_score": box.get("score"),
            "variants": recorder.variants.get(idx, []),
        })
    return {
        "table_found": table_box is not None,
        "table_box": table_box,
        "layout_boxes": layout_boxes,
        "cells": cells,
        "rec_errors": recorder.rec_errors,
        "unmatched_rec_calls": recorder.variants.get(-1, []),
        "table_data": result["table_data"],
        "confidence": result["confidence"],
        "total_cells": result["total_cells"],
        "confident_cells": result["confident_cells"],
        "marks": marks,
        "timing": {
            "total_s": t1 - t0 - recorder.overhead,
            "layout_s": recorder.times["layout"],
            "cells_s": recorder.times["cells"],
            "recognition_s": recorder.times["recognition"],
            "recognition_calls": recorder.rec_calls,
            "proxy_overhead_s": recorder.overhead,
        },
    }


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def model_pins(names):
    root = os.path.join(os.environ.get("PADDLE_PDX_CACHE_HOME", os.path.join(os.path.expanduser("~"), ".paddlex")),
                        "official_models")
    pins = {}
    for n in names:
        p = os.path.join(root, n, "inference.pdiparams")
        pins[n] = sha256_file(p) if os.path.exists(p) else None
    return pins


def environment(config, model_names):
    from importlib.metadata import version

    def ver(pkg):
        try:
            return version(pkg)
        except Exception:
            return None

    try:
        commit = subprocess.check_output(["git", "-C", ML_DIR, "rev-parse", "HEAD"], text=True).strip()
        dirty = bool(subprocess.check_output(["git", "-C", ML_DIR, "status", "--porcelain", "--", "."], text=True).strip())
    except Exception:
        commit, dirty = None, None
    cpu = platform.processor()
    try:
        import psutil
        cores = {"physical": psutil.cpu_count(logical=False), "logical": psutil.cpu_count(logical=True),
                 "ram_gb": round(psutil.virtual_memory().total / 2**30, 1)}
    except Exception:
        cores = {}
    try:
        import paddle
        device = paddle.device.get_device()
    except Exception:
        device = None
    return {
        "config": config,
        "started": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "platform": platform.platform(),
        "cpu": cpu,
        **cores,
        "python": platform.python_version(),
        "paddle_device": device,
        "packages": {p: ver(p) for p in ["paddlepaddle", "paddleocr", "paddlex", "opencv-python", "numpy"]},
        "git_commit": commit,
        "ml_server_dirty": dirty,
        "model_sha256": model_pins(model_names),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True,
                    choices=["full", "full_client", "no_layout", "direct_ocr", "table_pipeline"])
    ap.add_argument("--images", required=True)
    ap.add_argument("--gt", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", nargs="*", help="image file names to run (default: all in --gt)")
    args = ap.parse_args()

    with open(args.gt) as f:
        gt = json.load(f)
    names = sorted(args.only or gt.keys(), key=image_sort_key)
    os.makedirs(args.out, exist_ok=True)
    log_path = os.path.join(args.out, "pipeline_stdout.log")

    if args.config in ("full", "full_client", "no_layout"):
        recorder = Recorder()
        t_load = time.perf_counter()
        load_production_models(recorder)
        load_s = time.perf_counter() - t_load
        model_names = PRODUCTION_MODELS
        if args.config == "no_layout":
            ocr_app.unwarp_and_detect_tables = lambda image_path, output_dir: None

        if args.config == "full_client":
            def run_one(path):
                tmp = os.path.join(recorder.tmp_dir, "client_" + os.path.basename(path))
                size = client_preprocess(path, tmp)
                entry = run_production(tmp, recorder)
                entry["input_size"] = list(size)
                os.remove(tmp)
                return entry
        else:
            def run_one(path):
                return run_production(path, recorder)
    else:
        import baselines
        t_load = time.perf_counter()
        runner = baselines.make_runner(args.config)
        load_s = time.perf_counter() - t_load
        model_names = runner.model_names

        def run_one(path):
            return runner.run(path)

    env = environment(args.config, model_names)
    env["model_load_s"] = load_s
    with open(os.path.join(args.out, "env.json"), "w") as f:
        json.dump(env, f, indent=2)

    with open(log_path, "a", encoding="utf-8") as log:
        for i, name in enumerate(names, 1):
            out_path = os.path.join(args.out, os.path.splitext(name)[0] + ".json")
            if os.path.exists(out_path):
                continue
            path = os.path.join(args.images, name)
            print(f"\n===== {name} =====", file=log, flush=True)
            try:
                with contextlib.redirect_stdout(log):
                    entry = run_one(path)
                entry["status"] = "ok"
            except Exception as e:
                entry = {"status": "error", "error": repr(e)}
            entry.update({"image": name, "config": args.config, "section_gt": gt[name]["section"]})
            with open(out_path, "w") as f:
                json.dump(to_jsonable(entry), f, indent=1)
            t = entry.get("timing", {}).get("total_s")
            print(f"[{args.config}] {i}/{len(names)} {name} {entry['status']} "
                  f"{'' if t is None else f'{t:.2f}s'}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
