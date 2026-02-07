from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import os
import shutil
import tempfile
import json
from typing import Dict, List, Optional
from paddleocr import TableCellsDetection, TextRecognition
import re

app = FastAPI(title="Marks Extraction API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # React app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instances
cell_detection_model = None
text_rec_model = None

class MarksResponse(BaseModel):
    success: bool
    marks: Optional[Dict[str, Dict[str, str]]] = None
    message: Optional[str] = None
    confidence: Optional[float] = None
    raw_table: Optional[List[List[str]]] = None

def preprocess_cell_for_ocr(cell_image):
    """Preprocess cell image for better OCR accuracy"""
    if cell_image.shape[0] < 10 or cell_image.shape[1] < 10:
        return [cell_image]
    
    if len(cell_image.shape) == 3:
        gray = cv2.cvtColor(cell_image, cv2.COLOR_BGR2GRAY)
    else:
        gray = cell_image
    
    preprocessed_versions = []
    
    height, width = gray.shape
    if height < 48:
        scale = 48 / height
        new_width = int(width * scale)
        new_height = 48
        gray = cv2.resize(gray, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
    elif height > 200:
        scale = 200 / height
        new_width = int(width * scale)
        new_height = 200
        gray = cv2.resize(gray, (new_width, new_height), interpolation=cv2.INTER_AREA)
    
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    denoised = cv2.fastNlMeansDenoising(enhanced, None, 10, 7, 21)
    adaptive = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 11, 2
    )
    if np.mean(adaptive) < 127:
        adaptive = cv2.bitwise_not(adaptive)
    preprocessed_versions.append(adaptive)
    
    denoised2 = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    _, otsu = cv2.threshold(denoised2, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.mean(otsu) < 127:
        otsu = cv2.bitwise_not(otsu)
    preprocessed_versions.append(otsu)
    
    kernel_sharpen = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharpened = cv2.filter2D(gray, -1, kernel_sharpen)
    denoised3 = cv2.fastNlMeansDenoising(sharpened, None, 10, 7, 21)
    preprocessed_versions.append(denoised3)
    
    preprocessed_versions.append(gray)
    
    return preprocessed_versions

def filter_allowed_characters(text):
    """Filter text to only allow a,b,c,d and numbers"""
    if not text:
        return ""
    allowed_pattern = re.compile(r'[^abcdABCD0-9.]')
    filtered_text = allowed_pattern.sub('', text)
    return filtered_text

def extract_table_from_image(image_path: str, confidence_threshold: float = 0.55) -> Dict:
    """Extract table data from image using OCR"""
    global cell_detection_model, text_rec_model
    
    # Create temporary directory
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Detect table cells
        detection_output = cell_detection_model.predict(image_path, threshold=0.3, batch_size=1)
        
        temp_json = os.path.join(temp_dir, "cell_detection.json")
        for res in detection_output:
            res.save_to_json(temp_json)
        
        with open(temp_json, "r") as f:
            detection_data = json.load(f)
        
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Failed to load image")
        
        all_results = []
        total_cells = len(detection_data["boxes"])
        
        # Process each cell
        for idx, box in enumerate(detection_data["boxes"]):
            x1, y1, x2, y2 = box["coordinate"]
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            
            cell_image = image[y1:y2, x1:x2]
            preprocessed_versions = preprocess_cell_for_ocr(cell_image)
            
            best_rec_text = ""
            best_rec_score = 0.0
            
            # Try different preprocessing versions
            for ver_idx, preprocessed in enumerate(preprocessed_versions):
                preprocessed_path = os.path.join(temp_dir, f"cell_{idx}_ver{ver_idx}.png")
                cv2.imwrite(preprocessed_path, preprocessed)
                
                try:
                    output = text_rec_model.predict(input=preprocessed_path, batch_size=1)
                    
                    for res in output:
                        rec_text = res.get('rec_text', '')
                        rec_score = res.get('rec_score', 0.0)
                        
                        if rec_score > best_rec_score or (
                            abs(rec_score - best_rec_score) < 0.05 and len(rec_text) > len(best_rec_text)
                        ):
                            best_rec_text = rec_text
                            best_rec_score = rec_score
                            
                except Exception as e:
                    continue
            
            cell_result = {
                "cell_index": idx,
                "coordinates": box["coordinate"],
                "rec_text": best_rec_text,
                "rec_score": best_rec_score
            }
            all_results.append(cell_result)
        
        # Process cells into table structure
        cells_with_center = []
        high_confidence_count = 0
        
        for result in all_results:
            x1, y1, x2, y2 = result["coordinates"]
            center_x = (x1 + x2) / 2
            center_y = (y1 + y2) / 2
            rec_text = result.get("rec_text", "")
            rec_score = result.get("rec_score", 0)
            
            if rec_score < confidence_threshold:
                filtered_text = ""
            else:
                high_confidence_count += 1
                filtered_text = filter_allowed_characters(rec_text)
            
            cells_with_center.append({
                "text": filtered_text,
                "center_x": center_x,
                "center_y": center_y,
                "score": rec_score
            })
        
        # Sort cells into rows
        cells_with_center.sort(key=lambda c: c["center_y"])
        
        rows = []
        current_row = []
        y_threshold = 30
        
        for cell in cells_with_center:
            if not current_row:
                current_row.append(cell)
            else:
                avg_y = sum(c["center_y"] for c in current_row) / len(current_row)
                if abs(cell["center_y"] - avg_y) < y_threshold:
                    current_row.append(cell)
                else:
                    current_row.sort(key=lambda c: c["center_x"])
                    rows.append(current_row)
                    current_row = [cell]
        
        if current_row:
            current_row.sort(key=lambda c: c["center_x"])
            rows.append(current_row)
        
        # Build table data
        table_data = []
        for row in rows:
            table_row = [cell["text"] for cell in row]
            table_data.append(table_row)
        
        # Calculate confidence
        avg_confidence = sum(result.get("rec_score", 0) for result in all_results) / len(all_results) if all_results else 0
        
        return {
            "table_data": table_data,
            "confidence": avg_confidence,
            "total_cells": total_cells,
            "confident_cells": high_confidence_count
        }
        
    finally:
        # Cleanup
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

def parse_marks_from_table(table_data: List[List[str]]) -> Dict[str, Dict[str, str]]:
    """Parse marks from table data into row/question structure"""
    # New structure: rows a-g with questions 1-4
    marks = {
        "a": {"1": "", "2": "", "3": "", "4": ""},
        "b": {"1": "", "2": "", "3": "", "4": ""},
        "c": {"1": "", "2": "", "3": "", "4": ""},
        "d": {"1": "", "2": "", "3": "", "4": ""},
        "e": {"1": "", "2": "", "3": "", "4": ""},
        "f": {"1": "", "2": "", "3": "", "4": ""},
        "g": {"1": "", "2": "", "3": "", "4": ""}
    }
    
    if len(table_data) < 2:
        return marks
    
    # Step 1: Find the header row (contains '1', '2', '3', '4')
    header_row_idx = -1
    question_col_indices = {}  # Map question number to column index
    
    for idx, row in enumerate(table_data):
        if len(row) < 4:
            continue
        
        # Check if this row contains question numbers 1, 2, 3, 4
        found_questions = {}
        for col_idx, cell in enumerate(row):
            cell_clean = cell.strip()
            if cell_clean in ['1', '2', '3', '4']:
                found_questions[cell_clean] = col_idx
        
        # If we found all 4 questions, this is the header row
        if len(found_questions) >= 4:
            header_row_idx = idx
            question_col_indices = found_questions
            print(f"  Found header at row {idx}: questions at columns {question_col_indices}")
            break
    
    # If no header found, fall back to assuming first row is header
    if header_row_idx == -1:
        print("  Warning: Could not find header row with questions 1-4")
        header_row_idx = 0
        # Assume standard layout: column 1-4 are questions
        question_col_indices = {'1': 1, '2': 2, '3': 3, '4': 4}
    
    # Step 2: Process data rows after header
    row_labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    data_row_idx = 0
    
    for table_row_idx in range(header_row_idx + 1, len(table_data)):
        row = table_data[table_row_idx]
        
        # Skip completely empty rows
        if len(row) == 0 or all(cell.strip() == '' for cell in row):
            continue
        
        # Check if this is a "Total" row by examining first column
        first_col = row[0].strip().lower() if len(row) > 0 else ''
        if 'total' in first_col or 'sum' in first_col:
            print(f"  Skipping Total row at index {table_row_idx}")
            continue
        
        # Check if this row has at least one numeric value in question columns
        has_data = False
        for question, col_idx in question_col_indices.items():
            if col_idx < len(row):
                cell_value = row[col_idx].strip()
                if cell_value and re.search(r'\d', cell_value):
                    has_data = True
                    break
        
        # Skip rows without any numeric data
        if not has_data:
            continue
        
        # Assign to the next available row label based on position
        if data_row_idx < len(row_labels):
            row_key = row_labels[data_row_idx]
            
            # Extract marks for questions 1, 2, 3, 4 using column indices from header
            for question in ['1', '2', '3', '4']:
                if question in question_col_indices:
                    col_idx = question_col_indices[question]
                    if col_idx < len(row):
                        value = row[col_idx].strip()
                        # Clean value - keep only numbers and decimal point
                        cleaned_value = re.sub(r'[^0-9.]', '', value)
                        marks[row_key][question] = cleaned_value
            
            print(f"  Parsed row {row_key}: {marks[row_key]}")
            data_row_idx += 1
    
    return marks

@app.on_event("startup")
async def startup_event():
    """Initialize ML models on startup"""
    global cell_detection_model, text_rec_model
    
    print("Loading ML models...")
    
    cell_detection_model = TableCellsDetection(model_name="RT-DETR-L_wired_table_cell_det")
    text_rec_model = TextRecognition(model_name="en_PP-OCRv5_mobile_rec")
    
    print("✓ ML models loaded successfully")

@app.get("/")
async def root():
    return {"message": "Marks Extraction API is running", "version": "1.0.0"}

@app.post("/api/extract-marks", response_model=MarksResponse)
async def extract_marks(image: UploadFile = File(...)):
    """
    Extract marks from uploaded answer sheet image
    """
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Save uploaded file temporarily
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(image.filename)[1])
    
    try:
        # Write uploaded file
        contents = await image.read()
        temp_file.write(contents)
        temp_file.close()
        
        # Extract table from image
        result = extract_table_from_image(temp_file.name)
        
        # Log raw table data for debugging
        print("Raw table data extracted:")
        for i, row in enumerate(result["table_data"]):
            print(f"  Row {i}: {row}")
        
        # Parse marks from table
        marks = parse_marks_from_table(result["table_data"])
        
        # Log parsed marks for debugging
        print("Parsed marks:")
        for row_label, questions in marks.items():
            print(f"  {row_label}: {questions}")
        
        return MarksResponse(
            success=True,
            marks=marks,
            confidence=result["confidence"],
            raw_table=result["table_data"],
            message="Marks extracted successfully"
        )
        
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")
    
    finally:
        # Cleanup
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_loaded": cell_detection_model is not None and text_rec_model is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
