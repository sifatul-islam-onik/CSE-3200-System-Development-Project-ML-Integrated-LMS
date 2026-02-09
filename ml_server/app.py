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
from paddleocr import TableCellsDetection, TextRecognition, LayoutDetection
from PIL import Image
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
layout_model = None
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

def unwarp_and_detect_tables(image_path, output_dir):
    """Detect and crop tables from the input image."""
    global layout_model
    
    print(f"  → Detecting tables...")
    
    # Detect tables directly in the input image (no unwarping)
    layout_output = layout_model.predict(image_path, batch_size=1, layout_nms=True)
    
    # Save detection results
    detection_json_path = os.path.join(output_dir, "table_detection.json")
    for res in layout_output:
        res.save_to_json(save_path=detection_json_path)
    
    # Load the input image for cropping
    original_image = Image.open(image_path)
    
    # Read the detection JSON
    with open(detection_json_path, "r") as f:
        res_dict = json.load(f)
    
    # Crop and save detected table (take first one)
    if 'boxes' in res_dict:
        for idx, box in enumerate(res_dict['boxes']):
            if box['label'] == "table":
                x1, y1, x2, y2 = box['coordinate']
                cropped_table = original_image.crop((x1, y1, x2, y2))
                
                # Save the cropped table
                output_filename = os.path.join(output_dir, "table_cropped.jpg")
                cropped_table.save(output_filename)
                print(f"  ✓ Table detected and cropped")
                return output_filename
        
        print(f"  ✗ No tables detected in the image")
        return None
    else:
        print(f"  ✗ No tables detected in the image")
        return None

def extract_table_from_image(image_path: str, confidence_threshold: float = 0.55) -> Dict:
    """Extract table data from image using OCR"""
    global layout_model, cell_detection_model, text_rec_model
    
    # Ensure models are loaded
    if (layout_model is None or cell_detection_model is None or text_rec_model is None):
        raise RuntimeError("ML models are not initialized. Please restart the server.")
    
    # Create temporary directory
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Step 1: Detect table
        cropped_table_path = unwarp_and_detect_tables(image_path, temp_dir)
        
        # If no table detected, process original image
        if cropped_table_path is None:
            print("  → Processing original image (no table detected)")
            cropped_table_path = image_path
        else:
            # Use the cropped table for cell detection
            image_path = cropped_table_path
        
        # Step 2: Detect table cells
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
    
    # Find header row (contains multiple question numbers 1-4)
    header_row_idx = -1
    for idx, row in enumerate(table_data):
        if len(row) < 4:
            continue
        # Count how many cells contain question numbers
        question_count = sum(1 for cell in row if cell.strip() in ['1', '2', '3', '4'])
        if question_count >= 3:
            header_row_idx = idx
            print(f"  Found header row at {idx}: {row}")
            break
    
    if header_row_idx == -1:
        print("  Warning: No header row found, assuming row 0")
        header_row_idx = 0
    
    # Position-based parsing: rows after header are a, b, c, d, e, f, g in order
    row_labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    student_idx = 0
    
    for table_row_idx in range(header_row_idx + 1, len(table_data)):
        row = table_data[table_row_idx]
        
        # Skip completely empty rows
        if len(row) == 0 or all(cell.strip() == '' for cell in row):
            continue
        
        # Skip rows with less than 2 cells (need at least label + one value)
        if len(row) < 2:
            continue
        
        # Check if first cell looks like a letter (even if misread)
        first_cell = row[0].strip().lower()
        # Accept if it's a single character letter, or empty (label might be misread)
        has_letter_label = (len(first_cell) == 1 and first_cell.isalpha()) or first_cell == ''
        
        # Skip if it looks like another header or doesn't have a label
        if not has_letter_label:
            continue
        
        # Assign to next available student position
        if student_idx >= len(row_labels):
            print(f"  Warning: More data rows than expected (already parsed {student_idx} students)")
            break
        
        row_key = row_labels[student_idx]
        
        # Extract numeric values from columns 1-4
        numeric_values = []
        for col_idx in range(1, min(5, len(row))):  # Take up to 4 values
            cell_value = row[col_idx].strip()
            cleaned_value = re.sub(r'[^0-9.]', '', cell_value)
            numeric_values.append(cleaned_value if cleaned_value else '')
        
        # Pad with empty strings if less than 4 values
        while len(numeric_values) < 4:
            numeric_values.append('')
        
        # Map to questions 1-4
        for i, question in enumerate(['1', '2', '3', '4']):
            marks[row_key][question] = numeric_values[i]
        
        print(f"  Parsed position {student_idx} as {row_key}: {marks[row_key]} (detected label: '{first_cell}')")
        student_idx += 1
        
        # Stop after finding all 7 students
        if student_idx >= 7:
            break
    
    return marks

@app.on_event("startup")
async def startup_event():
    """Initialize ML models on startup"""
    global layout_model, cell_detection_model, text_rec_model
    
    print("Loading ML models...")
    
    try:
        # Load layout detection model
        print("  → Loading layout detection model...")
        layout_model = LayoutDetection(model_name="PP-DocLayout_plus-L")
        print("  ✓ Layout detection model loaded")
        
        # Load table cell detection model
        print("  → Loading table cell detection model...")
        cell_detection_model = TableCellsDetection(model_name="RT-DETR-L_wired_table_cell_det")
        print("  ✓ Table cell detection model loaded")
        
        # Load text recognition model
        print("  → Loading text recognition model...")
        text_rec_model = TextRecognition(model_name="en_PP-OCRv5_mobile_rec")
        print("  ✓ Text recognition model loaded")
        
        # Verify models are properly initialized
        if (layout_model is None or cell_detection_model is None or text_rec_model is None):
            raise RuntimeError("Failed to initialize one or more models")
        
        print("✓ All ML models loaded successfully")
        
    except Exception as e:
        print(f"✗ Failed to load ML models: {str(e)}")
        import traceback
        traceback.print_exc()
        raise RuntimeError(f"Cannot start application: Model loading failed - {str(e)}")

@app.get("/")
async def root():
    return {"message": "Marks Extraction API is running", "version": "1.0.0"}

@app.post("/api/extract-marks", response_model=MarksResponse)
async def extract_marks(image: UploadFile = File(...)):
    """
    Extract marks from uploaded answer sheet image
    """
    # Check if models are loaded
    if (layout_model is None or cell_detection_model is None or text_rec_model is None):
        raise HTTPException(status_code=503, detail="ML models are not loaded. Server is not ready.")
    
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
    models_loaded = (layout_model is not None and
                    cell_detection_model is not None and text_rec_model is not None)
    return {
        "status": "ok" if models_loaded else "error",
        "models_loaded": models_loaded
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
