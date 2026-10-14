"""Blank the strip above the printed 'Signature of Invigilator' label (signature, stamp and date fragments).

For each image the strip runs from the top edge down to the lower edge of the printed rule above the label (fitted
as a straight line, so a tilted photo is followed), from a quarter of the width to the right edge, in displayed
(EXIF-applied) coordinates. It is filled with the median colour of the strip (the paper), and
the image is saved with the source's quantisation tables and chroma subsampling. The EXIF Orientation tag is kept
and the pixels stay in their stored orientation, so the file reads exactly like the other images.

Label positions come from the direct-OCR (B1) logs. Originals are moved to --backup first.

Usage (from ml_server/):
  venv/Scripts/python benchmark/blank_header_strip.py --images ../validation_data/benchmark_images \
      --b1 ../validation_data/ablation_runs/B1_direct_ocr --backup ../validation_data/originals_before_blanking \
      31 33 34 ...
"""
import argparse
import io
import json
import os
import shutil

import numpy as np
from PIL import Image, ImageOps, JpegImagePlugin

ORIENTATION = 0x0112
LEFT_FRACTION = 0.25
MARGIN_PX = 3


def label_box(b1_dir, number):
    with open(os.path.join(b1_dir, f"image_{number}.json")) as f:
        tokens = json.load(f)["tokens"]
    labels = sorted((t for t in tokens if "nvigil" in t["text"]), key=lambda t: t["box"][1])
    if not labels:
        raise ValueError(f"image_{number}: no 'Signature of Invigilator' label in the B1 log")
    return [int(v) for v in labels[0]["box"]]


def boundary(gray, box):
    """Per-column y below which nothing is blanked: the lower edge of the (possibly tilted) printed rule above the
    label, plus a margin. Falls back to just above the label's box when no rule is found."""
    import cv2
    h, w = gray.shape
    x1, y1, x2, _ = box
    fallback = np.full(w, max(0, y1 - MARGIN_PX), float)
    ya, yb, xa, xb = max(0, y1 - 120), min(h, y1 + 20), max(0, x1 - 300), min(w, x2 + 300)
    band = gray[ya:yb, xa:xb]
    if band.size == 0:
        return fallback
    dark = ((cv2.medianBlur(band, 31).astype(int) - band.astype(int)) > 50).astype(np.uint8)
    rule = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (150, 1)))
    cols = np.where(rule.any(axis=0))[0]
    if len(cols) < 200:
        return fallback
    bottoms = np.array([np.where(rule[:, c])[0].max() for c in cols]) + ya
    slope, intercept = np.polyfit(cols + xa, bottoms, 1)
    line = intercept + slope * np.arange(w) + MARGIN_PX
    return np.clip(line, 0, y1 + 20)


def blank(src_path, dst_path, box):
    src = Image.open(src_path)
    orientation = src.getexif().get(ORIENTATION)
    if orientation not in (None, 1, 8):
        raise ValueError(f"unsupported orientation {orientation}")
    shown = np.array(ImageOps.exif_transpose(src).convert("RGB"))
    h, w = shown.shape[:2]
    x0 = int(LEFT_FRACTION * w)
    gray = np.array(Image.fromarray(shown).convert("L"))
    limit = boundary(gray, box)
    yy, xx = np.mgrid[0:h, 0:w]
    mask = (yy < limit[None, :]) & (xx >= x0)
    paper = np.median(shown[mask].reshape(-1, 3), axis=0).astype(np.uint8)
    shown[mask] = paper
    y1 = int(np.ceil(limit[x0:].max()))
    out = Image.fromarray(shown)
    if orientation == 8:  # exif_transpose rotated 90 deg counter-clockwise; undo it to keep the stored layout
        out = out.transpose(Image.Transpose.ROTATE_270)
    kwargs = {"qtables": src.quantization, "subsampling": JpegImagePlugin.get_sampling(src)}
    if orientation == 8:
        exif = Image.Exif()
        exif[ORIENTATION] = 8
        kwargs["exif"] = exif.tobytes()
    out.save(dst_path, "JPEG", **kwargs)
    return (x0, 0, w, y1), paper


def check(original_path, new_path, box):
    a = np.array(ImageOps.exif_transpose(Image.open(original_path)).convert("RGB")).astype(float)
    b = np.array(ImageOps.exif_transpose(Image.open(io.BytesIO(open(new_path, "rb").read()))).convert("RGB")).astype(float)
    assert a.shape == b.shape, (a.shape, b.shape)
    x0, _, _, y1 = box
    mask = np.ones(a.shape[:2], bool)
    mask[:y1, x0:] = False
    mse = ((a - b) ** 2)[mask].mean()
    return 10 * np.log10(255 ** 2 / mse) if mse else float("inf")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True)
    ap.add_argument("--b1", required=True)
    ap.add_argument("--backup", required=True)
    ap.add_argument("numbers", nargs="+", type=int)
    args = ap.parse_args()
    os.makedirs(args.backup, exist_ok=True)
    for n in args.numbers:
        name = f"image_{n}.jpg"
        path, backup = os.path.join(args.images, name), os.path.join(args.backup, name)
        if not os.path.exists(backup):
            shutil.copy2(path, backup)
        box, paper = blank(backup, path, label_box(args.b1, n))
        psnr = check(backup, path, box)
        print(f"{name}: blanked x {box[0]}-{box[2]}, y 0-{box[3]} with {tuple(int(c) for c in paper)}; "
              f"PSNR outside the strip {psnr:.1f} dB")


if __name__ == "__main__":
    main()
