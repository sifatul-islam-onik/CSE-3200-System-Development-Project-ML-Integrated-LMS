"""Prepare the benchmark images for public release without changing a single decoded pixel.

The JPEG is rewritten segment by segment, never re-encoded:
  kept     SOI, APP0 (JFIF), APP2 ICC_PROFILE, APP14 (Adobe colour transform), DQT, DHT, SOF, DRI, SOS + scan data, EOI
  replaced APP1 Exif -> a minimal Exif block holding only the Orientation tag (dropped if there is no orientation)
  dropped  every other segment (rest of Exif incl. GPS, timestamps, camera data and thumbnail; XMP; MPF; vendor
           APPn blocks such as QTI debug data; comments) and anything after EOI (e.g. extra frames)

The script then checks that each released file decodes to exactly the same pixels as the original, both with
OpenCV (as the models read it, orientation applied) and with Pillow + exif_transpose (as app.py crops it).

Usage (from ml_server/):
  venv/Scripts/python benchmark/prepare_release.py --src ../validation_data/benchmark_images \
      --dst ../validation_data/zenodo_release/images
"""
import argparse
import os
import struct

import cv2
import numpy as np
from PIL import Image, ImageOps

KEEP_APP = {0xE0, 0xE2, 0xEE}  # JFIF, ICC profile (checked below), Adobe
ORIENTATION = 0x0112


def iter_segments(data):
    """Yield (marker, segment_bytes) for every segment up to and including EOI."""
    if data[:2] != b"\xff\xd8":
        raise ValueError("not a JPEG")
    yield 0xD8, data[:2]
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            raise ValueError(f"expected a marker at byte {i}")
        marker = data[i + 1]
        if marker == 0xD9:
            yield marker, data[i:i + 2]
            return
        if marker == 0xDA:  # start of scan: header, then entropy-coded data up to the next real marker
            length = struct.unpack(">H", data[i + 2:i + 4])[0]
            j = i + 2 + length
            while True:
                j = data.index(b"\xff", j)
                nxt = data[j + 1]
                if nxt == 0x00 or 0xD0 <= nxt <= 0xD7 or nxt == 0xFF:
                    j += 1 if nxt == 0xFF else 2
                    continue
                break
            yield marker, data[i:j]
            i = j
            continue
        length = struct.unpack(">H", data[i + 2:i + 4])[0]
        yield marker, data[i:i + 2 + length]
        i += 2 + length
    raise ValueError("no EOI marker")


def minimal_exif(orientation):
    exif = Image.Exif()
    exif[ORIENTATION] = orientation
    payload = exif.tobytes()
    if not payload.startswith(b"Exif\x00\x00"):
        payload = b"Exif\x00\x00" + payload
    return b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload


def clean_jpeg(data):
    orientation = Image.open(__import__("io").BytesIO(data)).getexif().get(ORIENTATION)
    out, dropped, exif_written = [], [], False
    for marker, seg in iter_segments(data):
        payload = seg[4:]
        if 0xE0 <= marker <= 0xEF:
            if marker == 0xE1 and payload.startswith(b"Exif\x00\x00"):
                if orientation and orientation != 1 and not exif_written:
                    out.append(minimal_exif(orientation))
                    exif_written = True
                dropped.append("Exif (all but Orientation)")
                continue
            if marker in KEEP_APP and (marker != 0xE2 or payload.startswith(b"ICC_PROFILE\x00")):
                out.append(seg)
                continue
            dropped.append(f"APP{marker - 0xE0}:{payload[:10]!r}")
            continue
        if marker == 0xFE:
            dropped.append("COM")
            continue
        out.append(seg)
    return b"".join(out), orientation, sorted(set(dropped))


def decoded_views(data):
    arr = np.frombuffer(data, np.uint8)
    cv = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    pil = np.asarray(ImageOps.exif_transpose(Image.open(__import__("io").BytesIO(data))).convert("RGB"))
    return cv, pil


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    args = ap.parse_args()
    os.makedirs(args.dst, exist_ok=True)

    names = sorted((n for n in os.listdir(args.src) if n.lower().endswith(".jpg")),
                   key=lambda n: int("".join(c for c in n if c.isdigit())))
    total_in = total_out = 0
    failures = []
    for name in names:
        with open(os.path.join(args.src, name), "rb") as f:
            original = f.read()
        cleaned, orientation, dropped = clean_jpeg(original)
        a_cv, a_pil = decoded_views(original)
        b_cv, b_pil = decoded_views(cleaned)
        same = a_cv.shape == b_cv.shape and np.array_equal(a_cv, b_cv) and np.array_equal(a_pil, b_pil)
        leftover = Image.open(__import__("io").BytesIO(cleaned)).getexif()
        if not same or set(leftover.keys()) - {ORIENTATION} or leftover.get_ifd(0x8825):
            failures.append(name)
            continue
        with open(os.path.join(args.dst, name), "wb") as f:
            f.write(cleaned)
        total_in += len(original)
        total_out += len(cleaned)
        print(f"{name}: orientation={orientation} {len(original) / 1e6:.2f} MB -> {len(cleaned) / 1e6:.2f} MB; "
              f"dropped {', '.join(dropped)}")
    print(f"\n{len(names) - len(failures)}/{len(names)} images written with identical pixels "
          f"({total_in / 1e6:.0f} MB -> {total_out / 1e6:.0f} MB)")
    if failures:
        print("NOT written (pixels differ or metadata left):", failures)


if __name__ == "__main__":
    main()
