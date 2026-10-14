"""Run one OCR queue throughput / failure experiment on an isolated local stack.

Starts, in order: a throwaway in-memory MongoDB with one teacher account (server/benchmark/start_test_db.js),
N ML workers (uvicorn app:app on ports 8001..800N), and the Node API (server/server.js) with OCR_CONCURRENCY
and ML_WORKER_URLS pointing at those workers. The API runs from an empty working directory with every setting
passed through the environment, so server/.env (production database, Redis and workers) is never read. Redis is
the local instance; the run uses its own database index, which is flushed before and after the run.

Then server/benchmark/load_test.js submits a burst of jobs, while a monitor samples CPU and RSS of every process
tree once per second. Optionally one worker is killed and restarted during the burst.

Usage (from ml_server/):
  venv/Scripts/python benchmark/run_scalability.py --workers 2 --out ../validation_data/scalability_runs/L2_r1 \
      [--kill-worker 2 --kill-at 60 --restart-at 180] [--affinity "0-3;4-7"]
"""
import argparse
import json
import os
import platform
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request

import psutil

HERE = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.dirname(HERE)
REPO = os.path.dirname(ML_DIR)
SERVER_DIR = os.path.join(REPO, "server")
VENV_PY = os.path.join(ML_DIR, "venv", "Scripts", "python.exe") if os.name == "nt" else os.path.join(ML_DIR, "venv", "bin", "python")


def redis_cmd(host, port, db, *cmd):
    def enc(parts):
        out = f"*{len(parts)}\r\n"
        for p in parts:
            out += f"${len(str(p).encode())}\r\n{p}\r\n"
        return out.encode()

    with socket.create_connection((host, port), timeout=10) as s:
        s.sendall(enc(["SELECT", db]) + enc(list(cmd)))
        time.sleep(0.3)
        return s.recv(4096).decode(errors="replace")


def http_ok(url, timeout=2):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def wait_for(url, timeout_s, label):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        if http_ok(url):
            return time.time()
        time.sleep(0.5)
    raise RuntimeError(f"{label} not ready after {timeout_s}s ({url})")


def kill_tree(proc):
    try:
        p = psutil.Process(proc.pid)
        procs = p.children(recursive=True) + [p]
    except psutil.NoSuchProcess:
        return
    for q in procs:
        try:
            q.kill()
        except psutil.NoSuchProcess:
            pass
    psutil.wait_procs(procs, timeout=10)


def parse_cpus(spec):
    cpus = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            cpus += list(range(int(a), int(b) + 1))
        else:
            cpus.append(int(part))
    return cpus


class Monitor(threading.Thread):
    def __init__(self, path, interval=1.0):
        super().__init__(daemon=True)
        self.path, self.interval = path, interval
        self.roots = {}  # label -> pid
        self.procs = {}  # pid -> psutil.Process
        self.stop_flag = threading.Event()
        self.lock = threading.Lock()

    def set_root(self, label, pid):
        with self.lock:
            self.roots[label] = pid

    def _tree(self, pid):
        try:
            root = psutil.Process(pid)
            return [root] + root.children(recursive=True)
        except psutil.NoSuchProcess:
            return []

    def run(self):
        psutil.cpu_percent(None)
        with open(self.path, "w") as f:
            f.write("t,label,cpu_percent,rss_mb,n_procs\n")
            while not self.stop_flag.is_set():
                time.sleep(self.interval)
                t = time.time()
                with self.lock:
                    roots = dict(self.roots)
                for label, pid in roots.items():
                    cpu = rss = 0.0
                    tree = self._tree(pid)
                    for q in tree:
                        p = self.procs.setdefault(q.pid, q)
                        try:
                            cpu += p.cpu_percent(None)
                            rss += p.memory_info().rss
                        except psutil.NoSuchProcess:
                            pass
                    f.write(f"{t:.3f},{label},{cpu:.1f},{rss / 2**20:.1f},{len(tree)}\n")
                vm = psutil.virtual_memory()
                f.write(f"{t:.3f},SYSTEM,{psutil.cpu_percent(None):.1f},{vm.used / 2**20:.1f},0\n")
                f.flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, required=True)
    ap.add_argument("--concurrency", type=int, default=None, help="OCR_CONCURRENCY (default: number of workers)")
    ap.add_argument("--names", default=",".join(f"image_{i:02d}.jpg" for i in range(1, 31)))
    ap.add_argument("--images", default=os.path.join(REPO, "validation_data", "benchmark_images"))
    ap.add_argument("--gt", default=os.path.join(REPO, "validation_data", "ground_truth.json"))
    ap.add_argument("--out", required=True)
    ap.add_argument("--api-port", type=int, default=5055)
    ap.add_argument("--mongo-port", type=int, default=27027)
    ap.add_argument("--worker-base-port", type=int, default=8001)
    ap.add_argument("--redis-host", default="127.0.0.1")
    ap.add_argument("--redis-port", type=int, default=6379)
    ap.add_argument("--redis-db", type=int, default=7)
    ap.add_argument("--affinity", default=None, help='per-worker logical CPU lists, e.g. "0-3;4-7"')
    ap.add_argument("--remote-workers", default=None,
                    help="comma-separated URLs of ML workers already running on other machines (LAN IP or ngrok); "
                         "added after the local workers, not started, stopped or monitored by this script")
    ap.add_argument("--api-key", default=None,
                    help="ML_API_KEY shared with remote workers (default: a random key, local workers only)")
    ap.add_argument("--kill-worker", type=int, default=None)
    ap.add_argument("--kill-at", type=float, default=60.0, help="seconds after all jobs are submitted")
    ap.add_argument("--restart-at", type=float, default=180.0)
    args = ap.parse_args()

    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)
    remote = [u.strip().rstrip("/") for u in (args.remote_workers or "").split(",") if u.strip()]
    concurrency = args.concurrency or (args.workers + len(remote))
    affinity = [parse_cpus(s) for s in args.affinity.split(";")] if args.affinity else None
    email = "loadtest@example.org"
    password = secrets.token_urlsafe(16)
    api_key = args.api_key or secrets.token_urlsafe(24)
    events = []

    def event(name, **kw):
        events.append({"t": time.time(), "event": name, **kw})
        print(f"[{time.strftime('%H:%M:%S')}] {name} {kw if kw else ''}", flush=True)

    keys_in_dotenv = set()
    dotenv_path = os.path.join(SERVER_DIR, ".env")
    if os.path.exists(dotenv_path):
        with open(dotenv_path) as f:
            keys_in_dotenv = {ln.split("=", 1)[0].strip() for ln in f if "=" in ln and not ln.lstrip().startswith("#")}
    base_env = {k: v for k, v in os.environ.items() if k not in keys_in_dotenv}

    redis_url = f"redis://{args.redis_host}:{args.redis_port}/{args.redis_db}"
    event("redis_flush", reply=redis_cmd(args.redis_host, args.redis_port, args.redis_db, "FLUSHDB").strip())

    procs = {}
    logs = []
    lt_lines = []
    monitor = Monitor(os.path.join(out, "monitor.csv"))

    def start_worker(k):
        port = args.worker_base_port + k - 1
        log = open(os.path.join(out, f"worker_{k}.log"), "a", encoding="utf-8")
        logs.append(log)
        # app.py prints non-ASCII status symbols; a redirected stdout would otherwise use the ANSI code page
        env = {**base_env, "ML_API_KEY": api_key, "DISABLE_MODEL_SOURCE_CHECK": "True", "PYTHONUNBUFFERED": "1",
               "PYTHONIOENCODING": "utf-8"}
        p = subprocess.Popen([VENV_PY, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(port)],
                             cwd=ML_DIR, env=env, stdout=log, stderr=subprocess.STDOUT)
        procs[f"worker-{k}"] = p
        monitor.set_root(f"worker-{k}", p.pid)
        if affinity:
            time.sleep(1.0)
            for q in [psutil.Process(p.pid)] + psutil.Process(p.pid).children(recursive=True):
                q.cpu_affinity(affinity[k - 1])
        return port

    try:
        mlog = open(os.path.join(out, "mongo.log"), "w", encoding="utf-8")
        logs.append(mlog)
        menv = {**base_env, "BENCH_MONGO_PORT": str(args.mongo_port), "BENCH_EMAIL": email, "BENCH_PASSWORD": password}
        mongo = subprocess.Popen(["node", os.path.join(SERVER_DIR, "benchmark", "start_test_db.js")], cwd=SERVER_DIR,
                                 env=menv, stdout=subprocess.PIPE, stderr=mlog, text=True)
        procs["mongo"] = mongo
        line = mongo.stdout.readline()
        mongo_info = json.loads(line)
        mongo_uri = mongo_info["uri"]
        event("mongo_ready")
        monitor.set_root("mongo", mongo.pid)

        ports = [start_worker(k) for k in range(1, args.workers + 1)]
        for k, port in enumerate(ports, 1):
            wait_for(f"http://127.0.0.1:{port}/health", 300, f"worker-{k}")
            event("worker_ready", worker=k)
        for k, url in enumerate(remote, len(ports) + 1):
            wait_for(f"{url}/health", 60, f"remote worker-{k} ({url})")
            event("remote_worker_ready", worker=k, url=url)
        worker_urls = [f"http://127.0.0.1:{p}" for p in ports] + remote

        api_cwd = os.path.join(out, "api_cwd")
        os.makedirs(api_cwd, exist_ok=True)
        api_env = {**base_env, "PORT": str(args.api_port), "MONGO_URI": mongo_uri, "REDIS_URL": redis_url,
                   "JWT_SECRET": secrets.token_urlsafe(32), "JWT_EXPIRE": "1d", "ML_API_KEY": api_key,
                   "ML_WORKER_URLS": ",".join(worker_urls),
                   "OCR_CONCURRENCY": str(concurrency), "NODE_ENV": "development"}
        alog = open(os.path.join(out, "api.log"), "w", encoding="utf-8")
        logs.append(alog)
        api = subprocess.Popen(["node", os.path.join(SERVER_DIR, "server.js")], cwd=api_cwd, env=api_env,
                               stdout=alog, stderr=subprocess.STDOUT)
        procs["api"] = api
        monitor.set_root("api", api.pid)
        wait_for(f"http://127.0.0.1:{args.api_port}/", 120, "api")
        time.sleep(5)  # first health check round
        event("api_ready")
        monitor.start()
        time.sleep(3)  # idle baseline samples

        lenv = {**base_env, "BENCH_EMAIL": email, "BENCH_PASSWORD": password}
        lt = subprocess.Popen(["node", os.path.join(SERVER_DIR, "benchmark", "load_test.js"),
                               "--api", f"http://127.0.0.1:{args.api_port}", "--redis", redis_url,
                               "--images", args.images, "--gt", args.gt, "--names", args.names, "--out", out],
                              cwd=SERVER_DIR, env=lenv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        event("load_test_started")

        def failure_injection(t_sub):
            k = args.kill_worker
            time.sleep(max(0.0, t_sub + args.kill_at - time.time()))
            kill_tree(procs[f"worker-{k}"])
            event("worker_killed", worker=k)
            time.sleep(max(0.0, t_sub + args.restart_at - time.time()))
            port = start_worker(k)
            event("worker_restarted", worker=k)
            wait_for(f"http://127.0.0.1:{port}/health", 300, f"worker-{k}")
            event("worker_ready_again", worker=k)

        injector = None
        for line in lt.stdout:
            lt_lines.append(line)
            print("  load_test:", line.rstrip(), flush=True)
            if line.startswith("submitted"):
                event("all_submitted")
                if args.kill_worker:
                    injector = threading.Thread(target=failure_injection, args=(time.time(),), daemon=True)
                    injector.start()
        lt.wait()
        event("load_test_finished", returncode=lt.returncode)
        time.sleep(3)
    finally:
        monitor.stop_flag.set()
        for name in ["api"] + [n for n in procs if n.startswith("worker")] + ["mongo"]:
            if name in procs:
                kill_tree(procs[name])
        for log in logs:
            log.close()
        db_path = (locals().get("mongo_info") or {}).get("dbPath")
        if db_path and os.path.basename(db_path).startswith("mongo-mem-"):
            shutil.rmtree(db_path, ignore_errors=True)
        try:
            event("redis_flush_after", reply=redis_cmd(args.redis_host, args.redis_port, args.redis_db, "FLUSHDB").strip())
        except Exception as e:
            event("redis_flush_failed", error=repr(e))

    try:
        node_v = subprocess.check_output(["node", "-v"], text=True).strip()
        commit = subprocess.check_output(["git", "-C", REPO, "rev-parse", "HEAD"], text=True).strip()
        dirty = subprocess.check_output(["git", "-C", REPO, "status", "--porcelain", "--", "server", "ml_server"],
                                        text=True).strip().splitlines()
    except Exception:
        node_v, commit, dirty = None, None, None
    meta = {
        "workers": args.workers + len(remote), "local_workers": args.workers, "remote_workers": remote,
        "concurrency": concurrency, "affinity": args.affinity, "names": args.names.split(","),
        "kill_worker": args.kill_worker, "kill_at": args.kill_at if args.kill_worker else None,
        "restart_at": args.restart_at if args.kill_worker else None,
        "platform": platform.platform(), "cpu_physical": psutil.cpu_count(False), "cpu_logical": psutil.cpu_count(True),
        "ram_gb": round(psutil.virtual_memory().total / 2**30, 1), "python": platform.python_version(), "node": node_v,
        "git_commit": commit, "git_dirty_paths": dirty, "events": events, "load_test_output": lt_lines,
    }
    with open(os.path.join(out, "run_meta.json"), "w") as f:
        json.dump(meta, f, indent=1)


if __name__ == "__main__":
    main()
