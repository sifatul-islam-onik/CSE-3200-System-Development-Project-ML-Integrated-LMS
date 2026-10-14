"""Analyse OCR benchmark logs written by run_ocr_benchmark.py.

Rebuilds A0 and the single-variant / threshold ablations (A2-A6) offline from the A0 log using the
production selection rule, row grouping and parse_marks_from_table, then computes the metrics:

  populated cell (gt != ""): correct if pred == gt, deletion if pred == "", otherwise substitution
  empty cell (gt == ""):     insertion if pred != "", otherwise true negative
  recall = exact accuracy = correct / populated;  precision = correct / (correct + sub + ins)
  all-cell accuracy = (correct + TN) / all cells;  digit accuracy = sum(max(0, len(g) - lev(g, p))) / digits
  95 % Wilson intervals; exact McNemar (two-sided binomial) on populated cells against live A0.

Usage (from ml_server/):
  venv/Scripts/python benchmark/analyze.py --runs ../validation_data/ablation_runs \
      --gt ../validation_data/ground_truth.json --manifest ../validation_data/scripts_manifest.csv
"""
import argparse
import contextlib
import csv
import io
import json
import math
import os
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import app as ocr_app  # noqa: E402

ROW_LABELS = list("abcdefg")
THRESHOLD = 0.55
SWEEP = [0.0, 0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8]
VARIANT_NAMES = {0: "v1 CLAHE+denoise+adaptive", 1: "v2 denoise+Otsu", 2: "v3 sharpen+denoise", 3: "v4 grayscale"}
LIVE_DIRS = {"A0": "A0_full", "A0c": "A0c_full_client", "A1": "A1_no_layout", "B1": "B1_direct_ocr",
             "B2": "B2_table_pipeline"}
LIVE_IDS = list(LIVE_DIRS)
SPLITS = ["dev", "test", "all"]


# ---------------------------------------------------------------- offline rebuild of the pipeline
def select_best(variants, ver=None):
    """Production selection rule over the variants in call order (optionally a single variant)."""
    best_text, best_score = "", 0.0
    for v in variants:
        if ver is not None and v["ver"] != ver:
            continue
        if v["score"] > best_score or (abs(v["score"] - best_score) < 0.05 and len(v["text"]) > len(best_text)):
            best_text, best_score = v["text"], v["score"]
    return best_text, best_score


def is_tiny(cell):
    x1, y1, x2, y2 = (int(c) for c in cell["coordinate"])
    return (y2 - y1) < 10 or (x2 - x1) < 10


def rebuild_rows(cells, ver=None, threshold=THRESHOLD):
    """Returns rows of (text, cell idx) exactly as extract_table_from_image builds table_data."""
    items = []
    for cell in cells:
        v = None if (ver is None or is_tiny(cell)) else ver
        text, score = select_best(cell["variants"], v)
        x1, y1, x2, y2 = cell["coordinate"]
        filtered = "" if score < threshold else ocr_app.filter_allowed_characters(text)
        items.append({"text": filtered, "idx": cell["idx"], "cx": (x1 + x2) / 2, "cy": (y1 + y2) / 2})
    items.sort(key=lambda c: c["cy"])
    rows, cur = [], []
    for c in items:
        if not cur:
            cur.append(c)
        elif abs(c["cy"] - sum(x["cy"] for x in cur) / len(cur)) < 30:
            cur.append(c)
        else:
            cur.sort(key=lambda x: x["cx"])
            rows.append(cur)
            cur = [c]
    if cur:
        cur.sort(key=lambda x: x["cx"])
        rows.append(cur)
    return [[(c["text"], c["idx"]) for c in row] for row in rows]


def parse_marks(table_data):
    with contextlib.redirect_stdout(io.StringIO()):
        return ocr_app.parse_marks_from_table(table_data)


def parse_provenance(rows, skipped=None):
    """Mirror of parse_marks_from_table that returns which cell index fed each (row, question).

    If `skipped` is a list, the physical row index and first-cell text of every non-empty row after the
    header that the parser skipped because its label was not a single letter are appended to it.
    """
    texts = [[t for t, _ in row] for row in rows]
    prov = {}
    if len(texts) < 2:
        return prov
    header, section = -1, "A"
    for i, row in enumerate(texts):
        if len(row) < 4:
            continue
        if sum(1 for c in row if c.strip() in "1 2 3 4".split()) >= 3:
            header, section = i, "A"
            break
        if sum(1 for c in row if c.strip() in "5 6 7 8".split()) >= 3:
            header, section = i, "B"
            break
    if header == -1:
        header = 0
    qs = "5 6 7 8".split() if section == "B" else "1 2 3 4".split()
    k = 0
    for ri in range(header + 1, len(texts)):
        row = texts[ri]
        if len(row) == 0 or all(c.strip() == "" for c in row) or len(row) < 2:
            continue
        first = row[0].strip().lower()
        if not ((len(first) == 1 and first.isalpha()) or first == ""):
            if skipped is not None:
                skipped.append((ri, row[0]))
            continue
        if k >= 7:
            break
        for qi, col in enumerate(range(1, min(5, len(row)))):
            prov[(ROW_LABELS[k], qs[qi])] = (rows[ri][col][1], ri)
        k += 1
        if k >= 7:
            break
    return prov


# ---------------------------------------------------------------- metrics
def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def wilson(k, n, z=1.959964):
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (c - h, c + h)


def mcnemar_exact(b, c):
    n = b + c
    if n == 0:
        return 1.0
    tail = sum(math.comb(n, i) for i in range(min(b, c) + 1)) / 2 ** n
    return min(1.0, 2 * tail)


def compare(gt_entry, marks):
    """Cell outcomes for one image: list of dicts (row, q, gt, pred, outcome)."""
    out = []
    for r in ROW_LABELS:
        for q, g in gt_entry["marks"][r].items():
            g = (g or "").strip()
            p = ((marks or {}).get(r, {}).get(q, "") or "").strip()
            if g:
                o = "correct" if p == g else ("deletion" if p == "" else "substitution")
            else:
                o = "insertion" if p else "tn"
            out.append({"row": r, "q": q, "gt": g, "pred": p, "outcome": o})
    return out


def metrics(per_image):
    """per_image: {image: [cell outcomes]} -> dict of metrics."""
    cnt = {"correct": 0, "deletion": 0, "substitution": 0, "insertion": 0, "tn": 0}
    digits = digit_ok = 0
    clean = 0
    for cells in per_image.values():
        bad = False
        for c in cells:
            cnt[c["outcome"]] += 1
            if c["gt"]:
                digits += len(c["gt"])
                digit_ok += max(0, len(c["gt"]) - lev(c["gt"], c["pred"]))
            if c["outcome"] not in ("correct", "tn"):
                bad = True
        clean += not bad
    populated = cnt["correct"] + cnt["deletion"] + cnt["substitution"]
    allcells = populated + cnt["insertion"] + cnt["tn"]
    out_vals = cnt["correct"] + cnt["substitution"] + cnt["insertion"]
    precision = cnt["correct"] / out_vals if out_vals else float("nan")
    recall = cnt["correct"] / populated if populated else float("nan")
    f1 = 2 * precision * recall / (precision + recall) if out_vals and (precision + recall) else float("nan")
    return {
        "images": len(per_image), **cnt, "populated": populated, "all_cells": allcells,
        "precision": precision, "recall": recall, "f1": f1,
        "exact_acc": recall, "exact_ci": wilson(cnt["correct"], populated),
        "allcell_acc": (cnt["correct"] + cnt["tn"]) / allcells if allcells else float("nan"),
        "allcell_ci": wilson(cnt["correct"] + cnt["tn"], allcells),
        "digit_ok": digit_ok, "digits": digits,
        "digit_acc": digit_ok / digits if digits else float("nan"), "digit_ci": wilson(digit_ok, digits),
        "clean_scripts": clean,
    }


def mcnemar_vs(ref, other, images):
    b = c = 0
    for im in images:
        for x, y in zip(ref[im], other[im]):
            if not x["gt"]:
                continue
            xr, yr = x["outcome"] == "correct", y["outcome"] == "correct"
            b += xr and not yr
            c += yr and not xr
    return b, c, mcnemar_exact(b, c)


def timing_stats(vals):
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    return {"n": len(vals), "mean": statistics.mean(vals), "sd": statistics.stdev(vals) if len(vals) > 1 else 0.0,
            "median": statistics.median(vals), "min": min(vals), "max": max(vals)}


# ---------------------------------------------------------------- io helpers
def load_run(path):
    runs = {}
    if not os.path.isdir(path):
        return runs
    for f in os.listdir(path):
        if f.endswith(".json") and f.startswith("image_"):
            with open(os.path.join(path, f)) as fh:
                e = json.load(fh)
            runs[e["image"]] = e
    return runs


def fmt_pct(x, ci=None):
    if x != x:
        return "-"
    s = f"{100 * x:.2f}"
    if ci:
        s += f" ({100 * ci[0]:.1f}-{100 * ci[1]:.1f})"
    return s


def fmt3(x):
    return "-" if x != x else f"{x:.3f}"


def write_csv(path, rows, fields=None):
    if not rows:
        return
    fields = fields or list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", required=True)
    ap.add_argument("--gt", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    out_dir = args.out or os.path.join(args.runs, "analysis")
    os.makedirs(out_dir, exist_ok=True)

    with open(args.gt) as f:
        gt = json.load(f)
    with open(args.manifest, newline="") as f:
        manifest = {r["image"]: r for r in csv.DictReader(f)}
    split_images = {
        "dev": sorted([i for i in gt if manifest[i]["split"] == "dev"], key=lambda s: int(s[6:-4])),
        "test": sorted([i for i in gt if manifest[i]["split"] == "test"], key=lambda s: int(s[6:-4])),
    }
    split_images["all"] = split_images["dev"] + split_images["test"]

    live = {k: load_run(os.path.join(args.runs, d)) for k, d in LIVE_DIRS.items()}
    a0 = live["A0"]
    if not a0:
        sys.exit("No A0 logs found")
    have = set(a0)
    for k in LIVE_IDS[1:]:
        if live[k] and set(live[k]) != have:
            print(f"note: {k} covers {len(set(live[k]) & have)}/{len(have)} of the A0 images; only common images compared")
            have &= set(live[k])
    split_images = {s: [i for i in ims if i in have] for s, ims in split_images.items()}
    images = split_images["all"]
    report = []

    # -- acceptance: offline rebuild equals live A0
    mismatch = []
    for im in images:
        e = a0[im]
        rows = rebuild_rows(e["cells"])
        table = [[t for t, _ in r] for r in rows]
        if table != e["table_data"] or parse_marks(table) != e["marks"]:
            mismatch.append(im)

    # -- configurations: name -> (description, {image: marks}, timing source or None)
    configs = {}
    configs["A0"] = ("Full pipeline (layout crop, cells, best of 4 variants, threshold 0.55)",
                     {im: a0[im]["marks"] for im in images}, "A0")
    if live["A0c"]:
        configs["A0c"] = ("A0 on the image as the web client sends it (orientation applied, max side 1920 px, JPEG 0.92)",
                          {im: live["A0c"][im].get("marks") for im in images}, "A0c")
    if live["A1"]:
        configs["A1"] = ("No layout crop: cell detection on the full image",
                         {im: live["A1"][im].get("marks") for im in images}, "A1")
    for ver, cid in [(3, "A2"), (0, "A3"), (1, "A4"), (2, "A5")]:
        for thr in (THRESHOLD, 0.0):
            name = cid if thr == THRESHOLD else f"{cid}@0"
            desc = f"Cells + {VARIANT_NAMES[ver]} only, threshold {thr:g}"
            configs[name] = (desc, {im: parse_marks([[t for t, _ in r] for r in rebuild_rows(a0[im]["cells"], ver, thr)])
                                    for im in images}, None)
    configs["A0@0"] = ("Full pipeline, best of 4, threshold 0",
                       {im: parse_marks([[t for t, _ in r] for r in rebuild_rows(a0[im]["cells"], None, 0.0)])
                        for im in images}, None)
    if live["B1"]:
        for thr in (THRESHOLD, 0.0):
            name = "B1" if thr == THRESHOLD else "B1@0"
            configs[name] = (f"Direct OCR on the original image (text det + same recogniser), threshold {thr:g}",
                             {im: live["B1"][im]["marks_by_threshold"][str(thr)]["marks"]
                              if live["B1"][im].get("status") == "ok" else None for im in images},
                             "B1" if thr == THRESHOLD else None)
    if live["B2"]:
        configs["B2"] = ("PaddleOCR TableRecognitionPipelineV2 (generic, default models)",
                         {im: live["B2"][im].get("marks") for im in images}, "B2")

    outcomes = {name: {im: compare(gt[im], m[im]) for im in images} for name, (_, m, _) in configs.items()}

    # -- main table
    main_rows = []
    for name, (desc, _, tsrc) in configs.items():
        for split in SPLITS:
            ims = split_images[split]
            m = metrics({im: outcomes[name][im] for im in ims})
            b, c, p = mcnemar_vs(outcomes["A0"], outcomes[name], ims)
            t = timing_stats([live[tsrc][im].get("timing", {}).get("total_s") for im in ims]) if tsrc else None
            main_rows.append({
                "config": name, "description": desc, "split": split, "images": m["images"],
                "populated": m["populated"], "correct": m["correct"], "deletions": m["deletion"],
                "substitutions": m["substitution"], "insertions": m["insertion"], "tn": m["tn"],
                "precision": m["precision"], "recall": m["recall"], "f1": m["f1"],
                "exact_acc": m["exact_acc"], "exact_ci_lo": m["exact_ci"][0], "exact_ci_hi": m["exact_ci"][1],
                "allcell_acc": m["allcell_acc"], "allcell_ci_lo": m["allcell_ci"][0], "allcell_ci_hi": m["allcell_ci"][1],
                "digit_ok": m["digit_ok"], "digits": m["digits"], "digit_acc": m["digit_acc"],
                "digit_ci_lo": m["digit_ci"][0], "digit_ci_hi": m["digit_ci"][1],
                "clean_scripts": m["clean_scripts"],
                "mcnemar_a0_only_correct": b, "mcnemar_other_only_correct": c, "mcnemar_p": p,
                "time_mean_s": t and t["mean"], "time_sd_s": t and t["sd"], "time_median_s": t and t["median"],
                "time_min_s": t and t["min"], "time_max_s": t and t["max"],
            })
    write_csv(os.path.join(out_dir, "main_table.csv"), main_rows)

    # -- threshold sweeps (A0 best-of-4 offline, B1)
    sweep_rows = []
    for thr in SWEEP:
        marks = {im: parse_marks([[t for t, _ in r] for r in rebuild_rows(a0[im]["cells"], None, thr)]) for im in images}
        oc = {im: compare(gt[im], marks[im]) for im in images}
        for split in SPLITS:
            m = metrics({im: oc[im] for im in split_images[split]})
            sweep_rows.append({"pipeline": "A0 best-of-4", "threshold": thr, "split": split, "correct": m["correct"],
                               "deletions": m["deletion"], "substitutions": m["substitution"],
                               "insertions": m["insertion"], "precision": m["precision"], "recall": m["recall"],
                               "f1": m["f1"], "clean_scripts": m["clean_scripts"], "images": m["images"]})
    if live["B1"]:
        for thr in SWEEP:
            oc = {im: compare(gt[im], live["B1"][im]["marks_by_threshold"][str(thr)]["marks"]
                              if live["B1"][im].get("status") == "ok" else None) for im in images}
            for split in SPLITS:
                m = metrics({im: oc[im] for im in split_images[split]})
                sweep_rows.append({"pipeline": "B1 direct OCR", "threshold": thr, "split": split,
                                   "correct": m["correct"], "deletions": m["deletion"],
                                   "substitutions": m["substitution"], "insertions": m["insertion"],
                                   "precision": m["precision"], "recall": m["recall"], "f1": m["f1"],
                                   "clean_scripts": m["clean_scripts"], "images": m["images"]})
    write_csv(os.path.join(out_dir, "threshold_sweep.csv"), sweep_rows)

    # -- error lists
    all_errors = []
    for name in configs:
        for im in images:
            for c in outcomes[name][im]:
                if c["outcome"] not in ("correct", "tn"):
                    all_errors.append({"config": name, "image": im, "split": manifest[im]["split"],
                                       "writer": manifest[im]["writer"], "section": gt[im]["section"], **c})
    write_csv(os.path.join(out_dir, "errors_all_configs.csv"), all_errors)

    # -- A0 error cells with variant scores (error explanation check)
    cell_rows = []
    for im in images:
        e = a0[im]
        rows = rebuild_rows(e["cells"])
        skipped = []
        prov = parse_provenance(rows, skipped)
        cells = {c["idx"]: c for c in e["cells"]}
        for c in outcomes["A0"][im]:
            if c["outcome"] in ("correct", "tn"):
                continue
            idx, phys_row = prov.get((c["row"], c["q"]), (None, None))
            row = {"image": im, "split": manifest[im]["split"], "writer": manifest[im]["writer"],
                   "row": c["row"], "q": c["q"], "gt": c["gt"], "pred": c["pred"], "outcome": c["outcome"],
                   "cell_idx": idx}
            shift = [s for s in skipped if phys_row is not None and s[0] < phys_row]
            if idx is None:
                row["cause"] = "no cell mapped (row/column structure)"
            elif shift:
                cell = cells[idx]
                row.update({"best_text": select_best(cell["variants"])[0],
                            "best_score": round(select_best(cell["variants"])[1], 4)})
                row["cause"] = (f"row shift: an earlier row label was read as {shift[0][1]!r}, "
                                f"so the parser skipped that row")
            else:
                cell = cells[idx]
                x1, y1, x2, y2 = (int(v) for v in cell["coordinate"])
                best_text, best_score = select_best(cell["variants"])
                row.update({"crop_w": x2 - x1, "crop_h": y2 - y1, "best_text": best_text,
                            "best_score": round(best_score, 4)})
                for v in cell["variants"]:
                    row[f"v{v['ver'] + 1}_text"] = v["text"]
                    row[f"v{v['ver'] + 1}_score"] = round(v["score"], 4)
                filt = ocr_app.filter_allowed_characters(best_text)
                if best_score < THRESHOLD:
                    any_right = any(v["text"].strip() == c["gt"] for v in cell["variants"])
                    row["cause"] = ("below threshold; best text " + ("== gt" if filt == c["gt"] else "!= gt")
                                    + ("; a variant read gt" if any_right else "; no variant read gt"))
                elif c["outcome"] == "insertion":
                    row["cause"] = "text in empty cell above threshold"
                elif filt != c["gt"]:
                    row["cause"] = "misread above threshold"
                else:
                    row["cause"] = "cell read right but mapped to another row/column"
            cell_rows.append(row)
    fields = ["image", "split", "writer", "row", "q", "gt", "pred", "outcome", "cause", "cell_idx", "crop_w",
              "crop_h", "best_text", "best_score"] + [f"v{i}_{k}" for i in range(1, 5) for k in ("text", "score")]
    write_csv(os.path.join(out_dir, "a0_error_cells.csv"), cell_rows, fields)

    # -- per writer (A0 and others)
    writer_rows = []
    writers = sorted({manifest[im]["writer"] for im in images}, key=lambda w: int(w[1:]))
    for name in [n for n in LIVE_IDS if n in configs]:
        for w in writers:
            ims = [im for im in images if manifest[im]["writer"] == w]
            m = metrics({im: outcomes[name][im] for im in ims})
            writer_rows.append({"config": name, "writer": w, "split": manifest[ims[0]]["split"], "images": len(ims),
                                "populated": m["populated"], "correct": m["correct"], "deletions": m["deletion"],
                                "substitutions": m["substitution"], "insertions": m["insertion"],
                                "exact_acc": m["exact_acc"], "clean_scripts": m["clean_scripts"]})
    write_csv(os.path.join(out_dir, "per_writer.csv"), writer_rows)

    # -- per image timings and confidence
    per_image = []
    for im in images:
        r = {"image": im, "split": manifest[im]["split"], "writer": manifest[im]["writer"],
             "section": gt[im]["section"], "a0_table_found": a0[im].get("table_found"),
             "a0_cells": len(a0[im].get("cells", [])), "a0_confidence": a0[im].get("confidence")}
        for k in LIVE_IDS:
            if live[k] and im in live[k]:
                r[f"{k}_time_s"] = live[k][im].get("timing", {}).get("total_s")
                r[f"{k}_status"] = live[k][im].get("status")
        for k in LIVE_IDS:
            if k in outcomes:
                r[f"{k}_errors"] = sum(c["outcome"] not in ("correct", "tn") for c in outcomes[k][im])
        if "A0" in live and a0[im].get("timing"):
            for part in ("layout_s", "cells_s", "recognition_s", "recognition_calls"):
                r[f"A0_{part}"] = a0[im]["timing"].get(part)
        per_image.append(r)
    write_csv(os.path.join(out_dir, "per_image.csv"), per_image)

    # ---------------------------------------------------------------- markdown report
    def tbl(header, rows):
        lines = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
        lines += ["| " + " | ".join(str(x) for x in r) + " |" for r in rows]
        return "\n".join(lines)

    report.append("# OCR ablation and baseline results\n")
    report.append(f"Images analysed: dev {len(split_images['dev'])}, test {len(split_images['test'])}. "
                  f"Configurations: {', '.join(configs)}.\n")
    report.append("## Acceptance checks\n")
    report.append(f"- Offline rebuild of A0 equals the live A0 output (table and marks) for "
                  f"{len(images) - len(mismatch)}/{len(images)} images."
                  + (f" Mismatches: {', '.join(mismatch)}" if mismatch else ""))
    dev_a0 = next(r for r in main_rows if r["config"] == "A0" and r["split"] == "dev")
    dev_err = sorted((e["image"], e["row"], e["q"], e["gt"], e["pred"]) for e in all_errors
                     if e["config"] == "A0" and e["split"] == "dev")
    published = sorted([("image_15.jpg", "b", "3", "11", ""), ("image_18.jpg", "c", "5", "11", ""),
                        ("image_19.jpg", "c", "5", "11", ""), ("image_28.jpg", "c", "6", "1", ""),
                        ("image_29.jpg", "c", "5", "1", "")])
    report.append(f"- Dev A0: {dev_a0['correct']}/{dev_a0['populated']} correct, {dev_a0['deletions']} deletions, "
                  f"{dev_a0['substitutions']} substitutions, {dev_a0['insertions']} insertions "
                  f"(published: 315/320, 5/0/0). Same five error cells as published: {dev_err == published}.")
    if dev_err != published:
        report.append(f"  - dev errors now: {dev_err}")
    report.append("")

    for split in SPLITS:
        report.append(f"## Main table: {split} ({len(split_images[split])} images)\n")
        rows = []
        for r in main_rows:
            if r["split"] != split:
                continue
            t = (f"{r['time_mean_s']:.2f} ({r['time_sd_s']:.2f})" if r["time_mean_s"] is not None else "-")
            rows.append([r["config"], r["description"], f"{r['correct']}/{r['populated']}", r["deletions"],
                         r["substitutions"], r["insertions"], fmt3(r["precision"]), fmt3(r["recall"]), fmt3(r["f1"]),
                         fmt_pct(r["exact_acc"], (r["exact_ci_lo"], r["exact_ci_hi"])),
                         fmt_pct(r["allcell_acc"]), fmt_pct(r["digit_acc"], (r["digit_ci_lo"], r["digit_ci_hi"])),
                         f"{r['clean_scripts']}/{r['images']}",
                         "-" if r["config"] == "A0" else f"{r['mcnemar_a0_only_correct']}/{r['mcnemar_other_only_correct']}, p={r['mcnemar_p']:.3g}",
                         t])
        report.append(tbl(["ID", "Configuration", "Correct", "Del", "Sub", "Ins", "P", "R", "F1",
                           "Exact acc % (95% CI)", "All-cell %", "Digit acc % (95% CI)", "No-correction scripts",
                           "McNemar vs A0 (A0-only/other-only)", "s/script mean (SD)"], rows))
        report.append("")

    report.append("## Threshold sweep (sensitivity only; 0.55 was not tuned on these results)\n")
    rows = [[r["pipeline"], r["threshold"], r["split"], r["correct"], r["deletions"], r["substitutions"],
             r["insertions"], fmt3(r["precision"]), fmt3(r["recall"]), fmt3(r["f1"]), f"{r['clean_scripts']}/{r['images']}"]
            for r in sweep_rows if r["split"] != "all"]
    report.append(tbl(["Pipeline", "Threshold", "Split", "Correct", "Del", "Sub", "Ins", "P", "R", "F1", "Clean"], rows))
    report.append("")

    report.append("## A0 per writer\n")
    rows = [[r["writer"], r["split"], r["images"], f"{r['correct']}/{r['populated']}", r["deletions"],
             r["substitutions"], r["insertions"], fmt_pct(r["exact_acc"]), f"{r['clean_scripts']}/{r['images']}"]
            for r in writer_rows if r["config"] == "A0"]
    report.append(tbl(["Writer", "Split", "Images", "Correct", "Del", "Sub", "Ins", "Exact %", "Clean"], rows))
    report.append("")

    def cause_group(cause):
        for key, label in (("row shift", "row shift after a misread row label"),
                           ("no cell", "cell not detected / row too short"),
                           ("below threshold", "best variant below 0.55"),
                           ("text in empty", "spurious text in an empty cell"),
                           ("misread", "misread above 0.55"),
                           ("mapped", "read right, mapped elsewhere")):
            if cause.startswith(key) or key in cause:
                return label
        return cause

    report.append("## A0 error mechanisms\n")
    groups = {}
    for r in cell_rows:
        g = groups.setdefault(cause_group(r.get("cause", "")), {"dev": 0, "test": 0, "images": set()})
        g[r["split"]] += 1
        g["images"].add(r["image"])
    report.append(tbl(["Mechanism", "Dev cells", "Test cells", "Images"],
                      [[k, v["dev"], v["test"], len(v["images"])] for k, v in
                       sorted(groups.items(), key=lambda kv: -(kv[1]["dev"] + kv[1]["test"]))]))
    report.append("")

    report.append("## A0 errors with variant scores\n")
    rows = [[r["image"], r["writer"], r["row"], r["q"], r["gt"], r["pred"] or "(empty)", r["outcome"], r.get("cause", ""),
             r.get("best_text", ""), r.get("best_score", ""),
             "; ".join(f"v{i}={r.get(f'v{i}_text', '')!r}:{r.get(f'v{i}_score', '')}" for i in range(1, 5))]
            for r in cell_rows]
    report.append(tbl(["Image", "Writer", "Row", "Q", "GT", "Pred", "Type", "Cause", "Best text", "Best score", "Variants"], rows))
    report.append("")

    before = load_run(os.path.join(args.runs, "A0_full_before_exif_fix"))
    if before:
        ims = [im for im in images if im in before]
        mb = metrics({im: compare(gt[im], before[im].get("marks")) for im in ims})
        ma = metrics({im: outcomes["A0"][im] for im in ims})
        report.append("## EXIF orientation fix (images with an EXIF Orientation tag)\n")
        report.append(f"Images: {len(ims)}. Before the fix (layout box applied to the unrotated pixels): "
                      f"{mb['correct']}/{mb['populated']} correct, {mb['clean_scripts']} clean scripts. "
                      f"After the fix (A0): {ma['correct']}/{ma['populated']} correct, {ma['clean_scripts']} clean scripts.\n")
    fixcheck = load_run(os.path.join(args.runs, "A0_fixcheck"))
    if fixcheck:
        same = [im for im in fixcheck if fixcheck[im].get("table_data") == a0[im].get("table_data")
                and fixcheck[im].get("marks") == a0[im].get("marks")]
        report.append(f"Fixed code on images without an orientation tag reproduces the earlier output for "
                      f"{len(same)}/{len(fixcheck)} images ({', '.join(sorted(fixcheck))}).\n")

    report.append("## A0 timing and confidence by split\n")
    rows = []
    for split in SPLITS:
        ims = [im for im in split_images[split] if a0[im].get("timing")]
        if not ims:
            continue
        t = timing_stats([a0[im]["timing"]["total_s"] for im in ims])
        conf = [a0[im]["confidence"] for im in ims]
        parts = {p: statistics.mean(a0[im]["timing"][p] for im in ims) for p in ("layout_s", "cells_s", "recognition_s")}
        found = sum(bool(a0[im].get("table_found")) for im in ims)
        rows.append([split, len(ims), f"{t['mean']:.2f}", f"{t['sd']:.2f}", f"{t['median']:.2f}", f"{t['min']:.2f}",
                     f"{t['max']:.2f}", f"{parts['layout_s']:.2f}", f"{parts['cells_s']:.2f}",
                     f"{parts['recognition_s']:.2f}", f"{statistics.mean(conf):.4f}", f"{min(conf):.4f}",
                     f"{max(conf):.4f}", f"{found}/{len(ims)}"])
    report.append(tbl(["Split", "n", "Mean s", "SD", "Median", "Min", "Max", "Layout s", "Cells s", "Recog. s",
                       "Conf. mean", "Conf. min", "Conf. max", "Table found"], rows))
    report.append("")

    with open(os.path.join(out_dir, "RESULTS.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(report))
    print("\n".join(report[:12]))
    print(f"\nWrote {out_dir}")


if __name__ == "__main__":
    main()
