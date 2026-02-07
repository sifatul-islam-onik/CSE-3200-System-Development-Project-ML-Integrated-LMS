import json
import cv2
import os
import shutil
import glob
import re
import numpy as np
from paddleocr import TableCellsDetection, TextRecognition, LayoutDetection
from PIL import Image

def preprocess_cell_for_ocr(cell_image):
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
    if not text:
        return ""
    # Allow a-g (row labels), 0-9 (numbers), and decimal points
    allowed_pattern = re.compile(r'[^abcdefgABCDEFG0-9.]')
    filtered_text = allowed_pattern.sub('', text)
    return filtered_text

def unwarp_and_detect_tables(image_path, output_dir, layout_model=None):
    """
    Detect and crop tables from the input image.
    Returns a list of paths to cropped table images.
    
    Args:
        image_path: Path to input image
        output_dir: Directory to save outputs
        layout_model: Pre-loaded LayoutDetection model (loads new one if None)
    """
    print(f"  → Detecting tables...")
    
    # Detect tables in the input image directly (no unwarping)
    # Only load model if not provided
    if layout_model is None:
        layout_model = LayoutDetection(model_name="PP-DocLayout_plus-L")
    
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
    
    # Crop and save detected tables
    cropped_table_paths = []
    tables_dir = os.path.join(output_dir, "cropped_tables")
    os.makedirs(tables_dir, exist_ok=True)
    
    if 'boxes' in res_dict:
        table_count = 0
        for idx, box in enumerate(res_dict['boxes']):
            if box['label'] == "table":
                # Extract coordinates [x1, y1, x2, y2]
                x1, y1, x2, y2 = box['coordinate']
                
                # Crop the table region
                cropped_table = original_image.crop((x1, y1, x2, y2))
                
                # Save the cropped table
                output_filename = os.path.join(tables_dir, f"table_{table_count}.jpg")
                cropped_table.save(output_filename)
                cropped_table_paths.append(output_filename)
                table_count += 1
        
        print(f"  ✓ Detected and cropped {table_count} table(s)")
    else:
        print(f"  ✗ No tables detected in the image")
    
    return cropped_table_paths

def process_single_image(image_path, output_dir, temp_dir, cell_detection_model, text_rec_model, confidence_threshold=0.60):
    
    detection_output = cell_detection_model.predict(image_path, threshold=0.3, batch_size=1)
    
    temp_json = os.path.join(temp_dir, "cell_detection.json")
    for res in detection_output:
        res.save_to_json(temp_json)
    
    with open(temp_json, "r") as f:
        detection_data = json.load(f)
    
    image = cv2.imread(image_path)
    if image is None:
        return None
    
    all_results = []
    total_cells = len(detection_data["boxes"])
    
    for idx, box in enumerate(detection_data["boxes"]):
        x1, y1, x2, y2 = box["coordinate"]
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        
        progress = ((idx + 1) / total_cells) * 100
        print(f"  Progress: {progress:.1f}% ({idx + 1}/{total_cells} cells)", end="\r")
        
        cell_image = image[y1:y2, x1:x2]
        
        cell_image_path = os.path.join(temp_dir, f"cell_{idx}_original.png")
        cv2.imwrite(cell_image_path, cell_image)
        
        preprocessed_versions = preprocess_cell_for_ocr(cell_image)
        
        best_rec_text = ""
        best_rec_score = 0.0
        best_version_idx = 0
        
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
                        best_version_idx = ver_idx
                        
            except Exception as e:
                continue
        
        cell_result = {
            "cell_index": idx,
            "coordinates": box["coordinate"],
            "label": box["label"],
            "score": box["score"],
            "rec_text": best_rec_text,
            "rec_score": best_rec_score,
            "preprocessing_version": best_version_idx
        }
        all_results.append(cell_result)
    
    print(" " * 80, end="\r")
    
    cells_with_center = []
    low_confidence_count = 0
    high_confidence_count = 0
    
    for result in all_results:
        x1, y1, x2, y2 = result["coordinates"]
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
        rec_text = result.get("rec_text", "")
        rec_score = result.get("rec_score", 0)
        
        if rec_score < confidence_threshold:
            filtered_text = ""
            low_confidence_count += 1
        else:
            high_confidence_count += 1
            filtered_text = filter_allowed_characters(rec_text)
        
        cells_with_center.append({
            "text": filtered_text,
            "original_text": rec_text,
            "center_x": center_x,
            "center_y": center_y,
            "score": rec_score
        })
    
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
    
    table_data = []
    for row in rows:
        table_row = [cell["text"] for cell in row]
        table_data.append(table_row)
    
    num_cols = max(len(row) for row in table_data) if table_data else 0
    
    csv_path = os.path.join(output_dir, "table.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        for row in table_data:
            f.write(",".join(str(cell) for cell in row) + "\n")
    
    table_json = {
        "table": table_data,
        "num_rows": len(table_data),
        "num_cols": num_cols
    }
    table_json_path = os.path.join(output_dir, "table.json")
    with open(table_json_path, "w") as f:
        json.dump(table_json, f, indent=4)
    
    detailed_json_path = os.path.join(output_dir, "detailed_results.json")
    with open(detailed_json_path, "w") as f:
        json.dump(all_results, f, indent=4)
    
    total_cells = len(all_results)
    confidence_percentage = (high_confidence_count / total_cells * 100) if total_cells > 0 else 0
    
    sum_confidence = sum(result.get("rec_score", 0) for result in all_results if result.get("rec_score") is not None)
    avg_confidence = sum_confidence / total_cells if total_cells > 0 else 0
    
    return {
        "table_data": table_data,
        "total_cells": total_cells,
        "confident_cells": high_confidence_count,
        "low_confidence_cells": low_confidence_count,
        "confidence_percentage": confidence_percentage,
        "avg_confidence_score": avg_confidence,
        "num_rows": len(table_data),
        "num_cols": num_cols
    }

def main():
    IMAGES_DIR = "./images"
    OUTPUT_BASE_DIR = "./output"
    CONFIDENCE_THRESHOLD = 0.55
    
    image_extensions = ['*.png', '*.jpg', '*.jpeg', '*.bmp', '*.tiff']
    image_files = []
    for ext in image_extensions:
        image_files.extend(glob.glob(os.path.join(IMAGES_DIR, ext)))
    
    if not image_files:
        print(f"No images found in {IMAGES_DIR}")
        return
    
    total_images = len(image_files)
    print(f"Found {total_images} image(s) to process")
    print("="*60)
    
    # Load models once for all processing
    print("Loading models...")
    
    print("  → Loading layout detection model...")
    layout_model = LayoutDetection(model_name="PP-DocLayout_plus-L")
    print("  ✓ Layout detection model loaded")
    
    print("  → Loading cell detection model...")
    cell_detection_model = TableCellsDetection(model_name="RT-DETR-L_wired_table_cell_det",
                                               model_dir="E:\\CSE\\CODES\\fdskj\\models\\RT-DETR-L_wired_table_cell_det")
    print("  ✓ Cell detection model loaded")
    
    print("  → Loading text recognition model...")
    text_rec_model = TextRecognition(model_name="en_PP-OCRv5_mobile_rec")
    print("  ✓ Text recognition model loaded")
    
    print("✓ All models loaded\n")
    
    successful = 0
    failed = 0
    total_tables_processed = 0
    total_cells_all = 0
    confident_cells_all = 0
    total_confidence_score = 0.0
    
    for idx, image_path in enumerate(image_files, 1):
        image_name = os.path.basename(image_path)
        image_name_no_ext = os.path.splitext(image_name)[0]
        
        print(f"[{idx}/{total_images}] Processing: {image_name}")
        
        output_dir = os.path.join(OUTPUT_BASE_DIR, image_name_no_ext)
        os.makedirs(output_dir, exist_ok=True)
        
        try:
            # Step 1: Detect tables
            cropped_table_paths = unwarp_and_detect_tables(image_path, output_dir, layout_model)
            
            if not cropped_table_paths:
                failed += 1
                print(f"  ✗ No tables found to process\n")
                continue
            
            # Step 2: Process each detected table with OCR
            print(f"  → Processing {len(cropped_table_paths)} table(s) with OCR...")
            
            for table_idx, table_path in enumerate(cropped_table_paths):
                table_name = os.path.basename(table_path)
                print(f"    Table {table_idx + 1}/{len(cropped_table_paths)}: {table_name}")
                
                # Create output directory for this specific table
                table_output_dir = os.path.join(output_dir, f"table_{table_idx}")
                temp_dir = os.path.join(table_output_dir, "temp")
                os.makedirs(table_output_dir, exist_ok=True)
                os.makedirs(temp_dir, exist_ok=True)
                
                try:
                    result = process_single_image(
                        table_path, 
                        table_output_dir, 
                        temp_dir, 
                        cell_detection_model, 
                        text_rec_model, 
                        CONFIDENCE_THRESHOLD
                    )
                    
                    if result is not None:
                        total_tables_processed += 1
                        total_cells_all += result['total_cells']
                        confident_cells_all += result['confident_cells']
                        total_confidence_score += result['avg_confidence_score'] * result['total_cells']
                        
                        print(f"    ✓ Detected {result['num_rows']}x{result['num_cols']} table")
                        print(f"    ✓ Recognition: {result['confidence_percentage']:.1f}% ({result['confident_cells']}/{result['total_cells']} cells)")
                        print(f"    ✓ Avg confidence: {result['avg_confidence_score']:.3f}")
                    else:
                        print(f"    ✗ Failed to process table")
                except Exception as e:
                    print(f"    ✗ Error processing table: {str(e)}")
                finally:
                    if os.path.exists(temp_dir):
                        shutil.rmtree(temp_dir)
            
            successful += 1
            print(f"  ✓ Completed processing {image_name}\n")
            
        except Exception as e:
            failed += 1
            print(f"  ✗ Error: {str(e)}\n")
    
    print("="*60)
    print(f"Processing complete: {successful} images successful, {failed} failed")
    print(f"Total tables processed: {total_tables_processed}")
    
    if total_cells_all > 0:
        overall_recognition = (confident_cells_all / total_cells_all) * 100
        overall_avg_confidence = total_confidence_score / total_cells_all
        print(f"Overall Recognition: {overall_recognition:.1f}% ({confident_cells_all}/{total_cells_all} cells)")
        print(f"Average Confidence Score: {overall_avg_confidence:.3f}")
    
    print(f"Results saved in: {OUTPUT_BASE_DIR}")

if __name__ == "__main__":
    main()