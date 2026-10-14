"""Baselines for the OCR ablation study (imported by run_ocr_benchmark.py).

B1 direct_ocr
    PaddleOCR's general OCR pipeline (text detection + the production recogniser en_PP-OCRv5_mobile_rec)
    on the original image, with no table or cell localisation. Text detection (PP-OCRv5_server_det) runs with
    the long image side resized to 960 px (text_det_limit_type="max", text_det_limit_side_len=960), the classic
    PaddleOCR default and the setting PaddleX's table pipeline uses for its OCR. PaddleOCR 3.3.2's PP-OCRv5
    default (no downscaling up to 4000 px) crashed in paddlepaddle 3.0.0 on the benchmark CPU for inputs of
    1920 px and above, with or without oneDNN. Recognition still uses crops from the full-resolution image.
    Recognised text lines are mapped to
    the answer-sheet grid by the heuristic in map_tokens_to_marks():
      1. Header: group single-digit tokens into lines by y; the topmost line holding >= 3 distinct
         digits from {1,2,3,4} (Section A) or {5,6,7,8} (Section B) is the header. A least-squares
         fit of x against question index gives the four column centres and the column spacing.
      2. Row labels: single-letter tokens a-g lying below the header and within two column
         spacings left of the first column give the row centres (least-squares fit of y against
         row index; at least two labels are required).
      3. Every other token is thresholded on its recognition score, filtered with the production
         character filter, reduced to digits and '.', and assigned to the nearest row and column.
         Tokens more than half a spacing away from the nearest centre are discarded. Tokens that
         land in the same cell are concatenated from left to right.
      If the header or the row labels are not found, every cell stays empty.

B2 table_pipeline
    PaddleOCR's generic TableRecognitionPipelineV2 with its default models and settings. Each
    recognised table's pred_html is converted to rows of cell texts (colspan cells are padded with
    empty cells), the production character filter is applied, and the rows are parsed with the
    production parse_marks_from_table. The first table that contains a question header is used
    (the first table if none does). pred_html carries no per-cell scores, so no threshold applies.
"""
import os
import re
import statistics
import time
from html.parser import HTMLParser

import app as ocr_app

HEADER_SETS = {"A": ["1", "2", "3", "4"], "B": ["5", "6", "7", "8"]}
ROW_LABELS = list("abcdefg")
B1_THRESHOLDS = [0.0, 0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8]
MODELS_DIR = os.path.join(os.environ.get("PADDLE_PDX_CACHE_HOME", os.path.join(os.path.expanduser("~"), ".paddlex")),
                          "official_models")


def empty_marks():
    return {r: {str(q): "" for q in range(1, 9)} for r in ROW_LABELS}


def _fit(points):
    """Least-squares line v = a + b*i through (i, v) points."""
    n = len(points)
    mi = sum(i for i, _ in points) / n
    mv = sum(v for _, v in points) / n
    var = sum((i - mi) ** 2 for i, _ in points)
    b = sum((i - mi) * (v - mv) for i, v in points) / var
    return mv - b * mi, b


def map_tokens_to_marks(tokens, threshold):
    """B1 heuristic. tokens: [{text, score, box: [x1, y1, x2, y2]}]. Returns (marks, info)."""
    toks = []
    for t in tokens:
        x1, y1, x2, y2 = t["box"]
        toks.append({**t, "cx": (x1 + x2) / 2, "cy": (y1 + y2) / 2, "h": y2 - y1})
    info = {"section": None, "header_found": False, "labels_found": 0}
    if not toks:
        return empty_marks(), info
    med_h = statistics.median(t["h"] for t in toks)

    # 1. header
    digits = sorted((t for t in toks if t["text"].strip() in HEADER_SETS["A"] + HEADER_SETS["B"]),
                    key=lambda t: t["cy"])
    lines, cur = [], []
    for t in digits:
        if cur and abs(t["cy"] - sum(c["cy"] for c in cur) / len(cur)) >= 0.5 * med_h:
            lines.append(cur)
            cur = []
        cur.append(t)
    if cur:
        lines.append(cur)
    header, section = None, None
    for line in lines:
        for sec, labels in HEADER_SETS.items():
            if len({t["text"].strip() for t in line if t["text"].strip() in labels}) >= 3:
                header, section = line, sec
                break
        if header:
            break
    if header is None:
        return empty_marks(), info
    qlabels = HEADER_SETS[section]
    pts = {}
    for t in header:
        s = t["text"].strip()
        if s in qlabels and s not in pts:
            pts[s] = t["cx"]
    x0, dx = _fit([(qlabels.index(s), x) for s, x in pts.items()])
    col_x = [x0 + dx * i for i in range(4)]
    col_sp = abs(dx)
    header_y = sum(t["cy"] for t in header) / len(header)
    info.update({"section": section, "header_found": True, "col_x": col_x})

    # 2. row labels
    used = {id(t) for t in header}
    label_pts = {}
    for t in toks:
        s = t["text"].strip().lower()
        if (s in ROW_LABELS and t["cy"] > header_y
                and col_x[0] - 2 * col_sp < t["cx"] < col_x[0] - 0.5 * col_sp):
            prev = label_pts.get(s)
            if prev is None or abs(t["cx"] - (col_x[0] - col_sp)) < abs(prev["cx"] - (col_x[0] - col_sp)):
                label_pts[s] = t
    info["labels_found"] = len(label_pts)
    if len(label_pts) < 2:
        return empty_marks(), info
    used |= {id(t) for t in label_pts.values()}
    y0, dy = _fit([(ROW_LABELS.index(s), t["cy"]) for s, t in label_pts.items()])
    row_y = [y0 + dy * i for i in range(7)]
    row_sp = abs(dy)
    info["row_y"] = row_y

    # 3. assign values
    cells = {}
    for t in toks:
        if id(t) in used or t["score"] < threshold:
            continue
        value = re.sub(r"[^0-9.]", "", ocr_app.filter_allowed_characters(t["text"]))
        if not value:
            continue
        r = min(range(7), key=lambda i: abs(t["cy"] - row_y[i]))
        q = min(range(4), key=lambda i: abs(t["cx"] - col_x[i]))
        if abs(t["cy"] - row_y[r]) > 0.5 * row_sp or abs(t["cx"] - col_x[q]) > 0.5 * col_sp:
            continue
        cells.setdefault((r, q), []).append((t["cx"], value))
    marks = empty_marks()
    for (r, q), vals in cells.items():
        marks[ROW_LABELS[r]][qlabels[q]] = "".join(v for _, v in sorted(vals))
    return marks, info


class _TableHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self._row, self._cell, self._span = [], None, None, 1

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th"):
            self._cell = []
            self._span = int(dict(attrs).get("colspan", 1) or 1)

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._row is not None and self._cell is not None:
            self._row.append("".join(self._cell).strip())
            self._row.extend([""] * (self._span - 1))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None


def html_to_rows(html):
    p = _TableHTML()
    p.feed(html or "")
    return p.rows


def _has_header(rows):
    for row in rows:
        cells = [c.strip() for c in row]
        if sum(c in HEADER_SETS["A"] for c in cells) >= 3 or sum(c in HEADER_SETS["B"] for c in cells) >= 3:
            return True
    return False


class DirectOCRRunner:
    def __init__(self):
        from paddleocr import PaddleOCR
        before = set(os.listdir(MODELS_DIR)) if os.path.isdir(MODELS_DIR) else set()
        self.pipeline = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            text_recognition_model_name="en_PP-OCRv5_mobile_rec",
            text_det_limit_type="max",
            text_det_limit_side_len=960,
        )
        after = set(os.listdir(MODELS_DIR)) if os.path.isdir(MODELS_DIR) else set()
        self.newly_downloaded = sorted(after - before)
        self.model_names = sorted(after - {"fonts"})

    def run(self, image_path):
        t0 = time.perf_counter()
        res = list(self.pipeline.predict(image_path))[0]
        t1 = time.perf_counter()
        texts, scores = res["rec_texts"], res["rec_scores"]
        boxes = res.get("rec_boxes")
        if boxes is None or len(boxes) != len(texts):
            boxes = [[min(p[0] for p in poly), min(p[1] for p in poly), max(p[0] for p in poly), max(p[1] for p in poly)]
                     for poly in res["rec_polys"]]
        tokens = [{"text": str(t), "score": float(s), "box": [float(v) for v in b]}
                  for t, s, b in zip(texts, scores, boxes)]
        by_thr = {}
        for thr in B1_THRESHOLDS:
            marks, info = map_tokens_to_marks(tokens, thr)
            by_thr[str(thr)] = {"marks": marks, "info": info}
        t2 = time.perf_counter()
        return {
            "model_settings": res.get("model_settings"),
            "text_det_params": res.get("text_det_params"),
            "tokens": tokens,
            "marks_by_threshold": by_thr,
            "marks": by_thr["0.55"]["marks"],
            "timing": {"total_s": t2 - t0, "ocr_s": t1 - t0, "mapping_s": t2 - t1},
        }


class TablePipelineRunner:
    def __init__(self):
        from paddleocr import TableRecognitionPipelineV2
        before = set(os.listdir(MODELS_DIR)) if os.path.isdir(MODELS_DIR) else set()
        self.pipeline = TableRecognitionPipelineV2()
        after = set(os.listdir(MODELS_DIR)) if os.path.isdir(MODELS_DIR) else set()
        self.newly_downloaded = sorted(after - before)
        self.model_names = sorted(after - {"fonts"})

    def run(self, image_path):
        t0 = time.perf_counter()
        res = list(self.pipeline.predict(image_path))[0]
        t1 = time.perf_counter()
        tables = []
        for t in res.get("table_res_list", []) or []:
            rows = html_to_rows(t.get("pred_html", ""))
            tables.append({"pred_html": t.get("pred_html", ""),
                           "rows": rows,
                           "filtered_rows": [[ocr_app.filter_allowed_characters(c) for c in r] for r in rows]})
        chosen = next((i for i, t in enumerate(tables) if _has_header(t["filtered_rows"])), 0 if tables else None)
        table_data = tables[chosen]["filtered_rows"] if chosen is not None else []
        marks = ocr_app.parse_marks_from_table(table_data)
        t2 = time.perf_counter()
        layout = res.get("layout_det_res") or {}
        return {
            "model_settings": res.get("model_settings"),
            "layout_boxes": layout.get("boxes") if isinstance(layout, dict) else None,
            "tables": tables,
            "chosen_table": chosen,
            "table_data": table_data,
            "marks": marks,
            "timing": {"total_s": t2 - t0, "pipeline_s": t1 - t0, "parse_s": t2 - t1},
        }


def make_runner(config):
    if config == "direct_ocr":
        return DirectOCRRunner()
    if config == "table_pipeline":
        return TablePipelineRunner()
    raise ValueError(config)
