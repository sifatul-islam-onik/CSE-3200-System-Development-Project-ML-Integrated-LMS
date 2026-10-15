"""Tabulate the measure_resources.py runs and check their marks against the main benchmark logs.

Usage (from ml_server/):
  venv/Scripts/python benchmark/summarize_resources.py --runs ../validation_data/resource_runs \
      --main ../validation_data/ablation_runs
"""
import argparse
import json
import os
import statistics

CONFIGS = [("A0", "A0_full"), ("A0c", "A0c_full_client"), ("A1", "A1_no_layout"), ("B1", "B1_direct_ocr")]


def marks(path):
    with open(path) as f:
        entry = json.load(f)
    if "marks_by_threshold" in entry:  # B1: the production threshold
        return entry["marks_by_threshold"].get("0.55")
    return entry.get("marks")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", required=True)
    ap.add_argument("--main", required=True)
    args = ap.parse_args()

    lines = ["| Config | Images | Peak memory, MB (OS peak working set) | Memory after model load, MB | "
             "CPU mean during processing, % (threads of 8) | CPU p95, % | Time per image, s (mean, this run) | "
             "Time per image, s (main run, same images) | Marks identical to main run |",
             "|---|---|---|---|---|---|---|---|---|"]
    for label, d in CONFIGS:
        run_dir = os.path.join(args.runs, d)
        with open(os.path.join(run_dir, "resource_summary.json")) as f:
            s = json.load(f)
        names = sorted(n for n in os.listdir(run_dir) if n.startswith("image_") and n.endswith(".json"))
        t_run, t_main, same = [], [], 0
        for n in names:
            with open(os.path.join(run_dir, n)) as f:
                t_run.append(json.load(f)["timing"]["total_s"])
            main_path = os.path.join(args.main, d, n)
            with open(main_path) as f:
                t_main.append(json.load(f)["timing"]["total_s"])
            same += marks(os.path.join(run_dir, n)) == marks(main_path)
        lines.append(
            f"| {label} | {len(names)} | {s['peak_working_set_mb_max_process']:.0f} | {s['rss_after_load_mb']:.0f} | "
            f"{s['cpu_mean_pct_processing']:.0f} ({s['cpu_mean_pct_processing'] / 100:.1f}) | "
            f"{s['cpu_p95_pct_processing']:.0f} | {statistics.mean(t_run):.1f} | {statistics.mean(t_main):.1f} | "
            f"{same}/{len(names)} |")
    text = "\n".join(lines)
    with open(os.path.join(args.runs, "RESOURCES.md"), "w", encoding="utf-8") as f:
        f.write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
