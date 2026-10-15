"""Measure CPU and memory of one benchmark configuration.

Runs run_ocr_benchmark.py unchanged as a child process (into a separate output folder) and samples its whole
process tree every 0.5 s: summed CPU percent and RSS. On Windows each process's peak working set is also read,
which is the operating system's own high-water mark and so cannot be missed between samples. The runner writes
env.json right before its image loop; its appearance splits the samples into start-up and model loading, and
image processing.

Usage (from ml_server/):
  venv/Scripts/python benchmark/measure_resources.py --config full --images ../validation_data/benchmark_images \
      --gt ../validation_data/ground_truth.json --out ../validation_data/resource_runs/A0_full \
      --only image_31.jpg image_41.jpg
"""
import argparse
import csv
import json
import os
import statistics
import subprocess
import sys
import threading
import time

import psutil

HERE = os.path.dirname(os.path.abspath(__file__))
INTERVAL_S = 0.5


def tree(root):
    try:
        return [root] + root.children(recursive=True)
    except psutil.NoSuchProcess:
        return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--images", required=True)
    ap.add_argument("--gt", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", nargs="+", required=True)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    cmd = [sys.executable, os.path.join(HERE, "run_ocr_benchmark.py"), "--config", args.config,
           "--images", args.images, "--gt", args.gt, "--out", args.out, "--only", *args.only]
    env_path = os.path.join(args.out, "env.json")
    if os.path.exists(env_path):
        os.remove(env_path)  # written by the runner right before its image loop: marks the end of model loading
    vm0 = psutil.virtual_memory()
    t0 = time.perf_counter()
    proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    root = psutil.Process(proc.pid)

    marks = []  # (t, finished image) from the runner's progress lines

    def read_progress():
        for line in proc.stderr:
            sys.stderr.write(line)
            if line.startswith(f"[{args.config}]"):
                marks.append((time.perf_counter() - t0, line.split()[2]))

    reader = threading.Thread(target=read_progress, daemon=True)
    reader.start()

    samples, peak_wset, seen, t_loaded = [], {}, {}, None
    logical = psutil.cpu_count(logical=True)
    while proc.poll() is None:
        cpu = rss = 0.0
        for p in tree(root):
            try:
                if p.pid not in seen:
                    seen[p.pid] = p
                    p.cpu_percent(None)
                    continue
                cpu += seen[p.pid].cpu_percent(None)
                mem = seen[p.pid].memory_info()
                rss += mem.rss
                if hasattr(mem, "peak_wset"):
                    peak_wset[p.pid] = max(peak_wset.get(p.pid, 0), mem.peak_wset)
            except psutil.NoSuchProcess:
                pass
        t = time.perf_counter() - t0
        if t_loaded is None and os.path.exists(env_path):
            t_loaded = t
        samples.append((t, "load" if t_loaded is None else "images", cpu, rss / 2**20,
                        psutil.virtual_memory().used / 2**20))
        time.sleep(INTERVAL_S)
    reader.join(timeout=5)
    wall = time.perf_counter() - t0

    with open(os.path.join(args.out, "resource_samples.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["t", "phase", "cpu_percent", "rss_mb", "system_used_mb"])
        w.writerows(samples)

    with open(env_path) as f:
        load_s = json.load(f).get("model_load_s")
    work = [s for s in samples if s[1] == "images"]
    cpu_work = [s[2] for s in work]
    summary = {
        "config": args.config,
        "images": len(marks),
        "wall_s": wall,
        "model_load_s": load_s,
        "logical_cpus": logical,
        "peak_rss_mb_sampled": max((s[3] for s in samples), default=None),
        "peak_working_set_mb_max_process": max(peak_wset.values(), default=0) / 2**20 or None,
        "startup_and_load_s": t_loaded,
        "rss_after_load_mb": work[0][3] if work else None,
        "peak_rss_mb_loading": max((s[3] for s in samples if s[1] == "load"), default=None),
        "cpu_mean_pct_processing": statistics.mean(cpu_work) if cpu_work else None,
        "cpu_p95_pct_processing": (sorted(cpu_work)[int(0.95 * (len(cpu_work) - 1))] if cpu_work else None),
        "cpu_peak_pct": max((s[2] for s in samples), default=None),
        "system_used_mb_before": vm0.used / 2**20,
        "system_used_mb_peak": max((s[4] for s in samples), default=None),
        "exit_code": proc.returncode,
    }
    with open(os.path.join(args.out, "resource_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
