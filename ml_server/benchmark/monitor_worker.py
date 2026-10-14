"""Record CPU and memory of the ML worker on a remote machine during a throughput run.

Run on the machine that hosts the worker, start it before the burst and stop it with Ctrl+C afterwards:
  venv/Scripts/python benchmark/monitor_worker.py --out worker_monitor.csv
It samples every process whose command line contains "uvicorn" and "app:app" (with its children) and the whole
system once per second, and writes the machine's CPU, core and RAM details to <out>.machine.json.
"""
import argparse
import json
import platform
import time

import psutil


def machine_info():
    info = {"platform": platform.platform(), "processor": platform.processor(),
            "cpu_physical": psutil.cpu_count(False), "cpu_logical": psutil.cpu_count(True),
            "ram_gb": round(psutil.virtual_memory().total / 2**30, 1), "python": platform.python_version()}
    if platform.system() == "Windows":
        try:
            import subprocess
            info["cpu_name"] = subprocess.check_output(
                ["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_Processor).Name"], text=True).strip()
        except Exception:
            pass
    return info


def worker_tree():
    procs = []
    for p in psutil.process_iter(["cmdline"]):
        cmd = " ".join(p.info.get("cmdline") or [])
        if "uvicorn" in cmd and "app:app" in cmd:
            procs.append(p)
            procs.extend(p.children(recursive=True))
    return {p.pid: p for p in procs}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--interval", type=float, default=1.0)
    args = ap.parse_args()
    with open(args.out + ".machine.json", "w") as f:
        json.dump(machine_info(), f, indent=1)

    known = {}
    psutil.cpu_percent(None)
    with open(args.out, "w") as f:
        f.write("t,label,cpu_percent,rss_mb,n_procs\n")
        print(f"Monitoring; writing {args.out}. Press Ctrl+C to stop.")
        try:
            while True:
                time.sleep(args.interval)
                t = time.time()
                tree = worker_tree()
                cpu = rss = 0.0
                for pid, p in tree.items():
                    p = known.setdefault(pid, p)
                    try:
                        cpu += p.cpu_percent(None)
                        rss += p.memory_info().rss
                    except psutil.NoSuchProcess:
                        pass
                vm = psutil.virtual_memory()
                f.write(f"{t:.3f},remote-worker,{cpu:.1f},{rss / 2**20:.1f},{len(tree)}\n")
                f.write(f"{t:.3f},REMOTE_SYSTEM,{psutil.cpu_percent(None):.1f},{vm.used / 2**20:.1f},0\n")
                f.flush()
        except KeyboardInterrupt:
            print("Stopped.")


if __name__ == "__main__":
    main()
