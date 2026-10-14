"""Summarise run_scalability.py outputs.

For every run directory (named <config>_r<repeat>, e.g. L1_r1) it reports throughput (completed jobs per minute
over the makespan, first createdAt to last completedAt), queue wait (startedAt - createdAt; startedAt is the last
attempt's start), service time (completedAt - startedAt), end-to-end time, retries, failures, jobs per worker,
CPU and peak RSS per process tree during the burst, and whether the marks returned under load equal the A0 log.
Runs sharing a config are aggregated as mean (SD).

Usage (from ml_server/):
  venv/Scripts/python benchmark/summarize_scalability.py --runs ../validation_data/scalability_runs \
      --a0 ../validation_data/ablation_runs/A0_full
"""
import argparse
import csv
import json
import os
import re
import statistics
from collections import defaultdict
from datetime import datetime


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() if s else None


def pct(vals, q):
    vals = sorted(vals)
    if not vals:
        return float("nan")
    k = (len(vals) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(vals) - 1)
    return vals[lo] + (vals[hi] - vals[lo]) * (k - lo)


def summarize_run(run_dir, a0_dir):
    with open(os.path.join(run_dir, "jobs.json")) as f:
        jobs = json.load(f)["rows"]
    with open(os.path.join(run_dir, "run_meta.json")) as f:
        meta = json.load(f)
    ev = {e["event"]: e["t"] for e in meta["events"]}

    done = [j for j in jobs if j.get("status") == "completed"]
    failed = [j for j in jobs if j.get("status") == "failed"]
    created = [ts(j["createdAt"]) for j in jobs if j.get("createdAt")]
    finished = [ts(j["completedAt"]) for j in jobs if j.get("completedAt")]
    makespan = max(finished) - min(created) if finished and created else float("nan")
    wait = [ts(j["startedAt"]) - ts(j["createdAt"]) for j in done]
    service = [ts(j["completedAt"]) - ts(j["startedAt"]) for j in done]
    e2e = [ts(j["completedAt"]) - ts(j["createdAt"]) for j in done]
    retried = [j for j in jobs if int(j.get("attemptNumber") or 1) > 1 or "retrying" in (j.get("observedStatuses") or "")]
    per_worker = defaultdict(int)
    for j in done:
        per_worker[j.get("processedBy")] += 1

    same = compared = 0
    for j in done:
        p = os.path.join(a0_dir, os.path.splitext(j["image"])[0] + ".json")
        if os.path.exists(p) and j.get("marks"):
            with open(p) as f:
                ref = json.load(f)["marks"]
            compared += 1
            same += json.loads(j["marks"]) == ref

    # resources during the burst (all_submitted .. load_test_finished)
    t_lo = ev.get("all_submitted", ev.get("load_test_started"))
    t_hi = ev.get("load_test_finished", float("inf"))
    cpu, rss = defaultdict(list), defaultdict(float)
    with open(os.path.join(run_dir, "monitor.csv")) as f:
        for r in csv.DictReader(f):
            t = float(r["t"])
            rss[r["label"]] = max(rss[r["label"]], float(r["rss_mb"]))
            if t_lo <= t <= t_hi:
                cpu[r["label"]].append(float(r["cpu_percent"]))
    logical = meta.get("cpu_logical") or 1
    workers = sorted(k for k in rss if k.startswith("worker"))
    return {
        "run": os.path.basename(run_dir), "workers": meta["workers"], "concurrency": meta["concurrency"],
        "affinity": meta.get("affinity"), "kill_worker": meta.get("kill_worker"),
        "jobs": len(jobs), "completed": len(done), "failed": len(failed),
        "submit_errors": sum(1 for j in jobs if j.get("submitError")),
        "retried_jobs": len(retried), "succeeded_after_retry": sum(1 for j in done if j.get("succeededAfterRetry") == "true"),
        "makespan_s": makespan, "throughput_per_min": 60 * len(done) / makespan if makespan == makespan else float("nan"),
        "wait_median_s": statistics.median(wait) if wait else float("nan"), "wait_p95_s": pct(wait, 0.95),
        "service_median_s": statistics.median(service) if service else float("nan"), "service_p95_s": pct(service, 0.95),
        "e2e_median_s": statistics.median(e2e) if e2e else float("nan"), "e2e_p95_s": pct(e2e, 0.95),
        "jobs_per_worker": dict(sorted(per_worker.items())),
        "worker_cpu_mean_pct": {w: statistics.mean(cpu[w]) if cpu[w] else float("nan") for w in workers},
        "worker_peak_rss_mb": {w: rss[w] for w in workers},
        "api_peak_rss_mb": rss.get("api"), "system_cpu_mean_pct": statistics.mean(cpu["SYSTEM"]) if cpu["SYSTEM"] else float("nan"),
        "system_peak_used_mb": rss.get("SYSTEM"), "logical_cpus": logical,
        "marks_identical_to_A0": f"{same}/{compared}",
        "failure_errors": sorted({j.get("error") for j in failed if j.get("error")}),
        "events": {k: round(v - ev.get("all_submitted", v), 1) for k, v in ev.items() if k.startswith("worker_") or k == "all_submitted"},
    }


def mean_sd(vals):
    vals = [v for v in vals if v == v]
    if not vals:
        return "-"
    if len(vals) == 1:
        return f"{vals[0]:.2f}"
    return f"{statistics.mean(vals):.2f} ({statistics.stdev(vals):.2f})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", required=True)
    ap.add_argument("--a0", required=True)
    args = ap.parse_args()

    runs = []
    for d in sorted(os.listdir(args.runs)):
        p = os.path.join(args.runs, d)
        if os.path.isdir(p) and os.path.exists(os.path.join(p, "jobs.json")):
            runs.append(summarize_run(p, args.a0))
    with open(os.path.join(args.runs, "runs_summary.json"), "w") as f:
        json.dump(runs, f, indent=1)

    groups = defaultdict(list)
    for r in runs:
        groups[re.sub(r"_r\d+$", "", r["run"])].append(r)
    lines = ["# OCR queue throughput on the laptop\n", "## Per configuration (mean (SD) over repeats)\n",
             "| Config | Repeats | Workers | Concurrency | Jobs | Completed | Failed | Retried | Makespan s | Throughput /min | "
             "Wait median s | Wait p95 s | Service median s | Service p95 s | E2E median s | E2E p95 s | System CPU % | "
             "Worker peak RSS MB | Identical to A0 |",
             "|" + "---|" * 19]
    for g, rs in groups.items():
        rss = [v for r in rs for v in r["worker_peak_rss_mb"].values()]
        lines.append("| " + " | ".join([
            g, str(len(rs)), str(rs[0]["workers"]), str(rs[0]["concurrency"]), str(rs[0]["jobs"]),
            mean_sd([r["completed"] for r in rs]), mean_sd([r["failed"] for r in rs]), mean_sd([r["retried_jobs"] for r in rs]),
            mean_sd([r["makespan_s"] for r in rs]), mean_sd([r["throughput_per_min"] for r in rs]),
            mean_sd([r["wait_median_s"] for r in rs]), mean_sd([r["wait_p95_s"] for r in rs]),
            mean_sd([r["service_median_s"] for r in rs]), mean_sd([r["service_p95_s"] for r in rs]),
            mean_sd([r["e2e_median_s"] for r in rs]), mean_sd([r["e2e_p95_s"] for r in rs]),
            mean_sd([r["system_cpu_mean_pct"] for r in rs]), f"{max(rss):.0f}" if rss else "-",
            ", ".join(r["marks_identical_to_A0"] for r in rs)]) + " |")
    lines.append("\n## Per run\n")
    for r in runs:
        lines.append(f"- **{r['run']}**: completed {r['completed']}/{r['jobs']}, failed {r['failed']}, retried "
                     f"{r['retried_jobs']} (succeeded after retry {r['succeeded_after_retry']}), throughput "
                     f"{r['throughput_per_min']:.2f}/min, jobs per worker {r['jobs_per_worker']}, worker CPU mean % "
                     f"{ {k: round(v) for k, v in r['worker_cpu_mean_pct'].items()} }, events {r['events']}"
                     + (f", failure errors {r['failure_errors']}" if r["failure_errors"] else ""))
    with open(os.path.join(args.runs, "SCALABILITY.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
