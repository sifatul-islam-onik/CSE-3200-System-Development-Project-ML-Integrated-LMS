---
title: Marks Extraction OCR API
emoji: 📝
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
app_port: 7860
---

# Marks Extraction OCR API

An advanced OCR-based API for extracting marks from answer sheet images using PaddleOCR.

## Features

- 🎯 Table detection and extraction
- 📊 Cell-level OCR with multiple preprocessing strategies
- ✅ High-confidence filtering
- 📈 Structured marks output

## API Endpoints

### `POST /api/extract-marks`
Upload an image of an answer sheet to extract marks.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `image` file (JPEG, PNG)

**Response:**
```json
{
  "success": true,
  "marks": {
    "a": {"1": "5", "2": "8", "3": "7", "4": "9"},
    "b": {"1": "6", "2": "7", "3": "8", "4": "10"},
    ...
  },
  "confidence": 0.87,
  "message": "Marks extracted successfully"
}
```

### `GET /health`
Check API health and model status.

### `GET /`
API information and available endpoints.

## Usage

```python
import requests

url = "https://your-space-name.hf.space/api/extract-marks"
files = {"image": open("answer_sheet.jpg", "rb")}
response = requests.post(url, files=files)
print(response.json())
```

## Technology Stack

- FastAPI for REST API
- PaddleOCR for table and text detection
- OpenCV for image preprocessing
- Docker for containerization

## Model Information

This API uses the following PaddleOCR models:
- `PP-DocLayout_plus-L` for layout detection
- `RT-DETR-L_wired_table_cell_det` for table cell detection
- `en_PP-OCRv5_mobile_rec` for text recognition

Models are automatically downloaded on first startup.
