"""Write benchmark images as the web client uploads them, for the throughput runs (run_scalability.py).

Uses client_preprocess() from run_ocr_benchmark.py, the same step as the `full_client` configuration:
EXIF orientation applied, fitted within 1920 x 1920 px, JPEG quality 0.92. The throughput runs in the
paper used the 30 development images (image_01 to image_30), which is the default.

Usage (from ml_server/):
  venv/Scripts/python benchmark/make_client_inputs.py --images <dataset>/images --out <dir>
"""
import argparse
import os

from run_ocr_benchmark import client_preprocess


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--names", default=",".join(f"image_{i:02d}.jpg" for i in range(1, 31)))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    for name in args.names.split(","):
        w, h = client_preprocess(os.path.join(args.images, name), os.path.join(args.out, name))
        print(f"{name}: {w} x {h}")


if __name__ == "__main__":
    main()
