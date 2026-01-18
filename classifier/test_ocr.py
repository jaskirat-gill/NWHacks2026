#!/usr/bin/env python3
"""
Quick OCR Test Script with Enhanced Debugging

Usage:
    python test_ocr.py <image_path>
    python test_ocr.py path/to/image.jpg

Tests the OCR functionality from VisualAnalyzer on a single image.
"""

import sys
import pytesseract
from PIL import Image
from visual_analyzer import VisualAnalyzer

# Check if tesseract is available
def check_tesseract():
    """Check if tesseract is installed and available."""
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False

def test_ocr(image_path: str):
    """Test OCR on a single image with detailed debugging."""
    # Check tesseract first
    if not check_tesseract():
        print("✗ ERROR: Tesseract OCR is not installed or not in PATH")
        print("\nTo install on Fedora/RHEL:")
        print("  sudo dnf install -y tesseract tesseract-langpack-eng")
        print("\nAfter installation, try running this script again.")
        return
    
    print(f"Testing OCR on: {image_path}")
    print("-" * 60)
    
    # Load image
    try:
        image = Image.open(image_path).convert("RGB")
        print(f"✓ Image loaded: {image.size[0]}x{image.size[1]}, format: {image.format}")
    except Exception as e:
        print(f"✗ Failed to load image: {e}")
        return
    
    # Initialize analyzer
    analyzer = VisualAnalyzer()
    
    # Test pytesseract directly first
    print("\n" + "=" * 60)
    print("DIRECT PYTESSERACT TEST (no preprocessing):")
    print("=" * 60)
    try:
        raw_text = pytesseract.image_to_string(image)
        print(f"Raw text (image_to_string): '{raw_text.strip()}'")
        
        raw_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        raw_words = [t for t in raw_data['text'] if t.strip()]
        print(f"Raw words found: {len(raw_words)}")
        if raw_words:
            print(f"  Words: {raw_words[:10]}")
    except Exception as e:
        print(f"✗ Direct pytesseract failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Test with preprocessing
    print("\n" + "=" * 60)
    print("PREPROCESSING TEST:")
    print("=" * 60)
    preprocessed = None
    try:
        preprocessed = analyzer._preprocess_for_ocr(image)
        print(f"Preprocessed size: {preprocessed.size[0]}x{preprocessed.size[1]}")
        print(f"Original size: {image.size[0]}x{image.size[1]}")
        upscaled = preprocessed.size[0] > image.size[0] or preprocessed.size[1] > image.size[1]
        print(f"Upscaled: {upscaled}")
        
        # Save preprocessed image for inspection
        try:
            preprocessed.save('test_preprocessed.jpg')
            print("✓ Saved preprocessed image to: test_preprocessed.jpg")
        except Exception as save_error:
            print(f"⚠ Could not save preprocessed image: {save_error}")
        
        # Test pytesseract on preprocessed
        try:
            preprocessed_text = pytesseract.image_to_string(preprocessed)
            print(f"\nPreprocessed text (image_to_string): '{preprocessed_text.strip()}'")
            
            preprocessed_data = pytesseract.image_to_data(preprocessed, output_type=pytesseract.Output.DICT)
            preprocessed_words = [t for t in preprocessed_data['text'] if t.strip()]
            print(f"Preprocessed words found: {len(preprocessed_words)}")
            if preprocessed_words:
                print(f"  Words: {preprocessed_words[:10]}")
        except Exception as ocr_error:
            print(f"✗ OCR on preprocessed image failed: {ocr_error}")
    except Exception as e:
        print(f"✗ Preprocessing failed: {e}")
        import traceback
        traceback.print_exc()
    
    if not preprocessed:
        print("⚠ Skipping PSM mode tests (preprocessing failed)")
        return
    
    # Test each PSM mode individually
    print("\n" + "=" * 60)
    print("PSM MODE TESTING:")
    print("=" * 60)
    psm_modes = [11, 6, 7, 8, 13]
    psm_names = {11: "Sparse text", 6: "Uniform block", 7: "Single line", 8: "Single word", 13: "Raw line"}
    
    for psm in psm_modes:
        try:
            config = f'--psm {psm}'
            ocr_data = pytesseract.image_to_data(preprocessed, config=config, output_type=pytesseract.Output.DICT)
            
            words = []
            confidences = []
            for i in range(len(ocr_data['text'])):
                text = ocr_data['text'][i].strip()
                conf = int(ocr_data['conf'][i])
                if text and conf > -1:
                    words.append(text)
                    confidences.append(conf)
            
            print(f"PSM {psm} ({psm_names.get(psm, 'Unknown')}): {len(words)} words found")
            if words:
                print(f"  Words: {words[:5]}")
                if confidences:
                    print(f"  Avg confidence: {sum(confidences)/len(confidences):.1f}")
        except Exception as e:
            print(f"PSM {psm}: ✗ Failed - {e}")
    
    # Run full OCR analysis
    print("\n" + "=" * 60)
    print("FULL OCR ANALYSIS (VisualAnalyzer):")
    print("=" * 60)
    try:
        text_result = analyzer._analyze_text(image)
        
        print(f"Text found: '{text_result.get('text_found', '')}'")
        print(f"Word count: {text_result.get('word_count', 0)}")
        print(f"OCR confidence: {text_result.get('ocr_confidence', 0.0):.4f}")
        print(f"Is gibberish: {text_result.get('is_gibberish', False)}")
        
        text_locations = text_result.get('text_locations', [])
        print(f"\nText locations ({len(text_locations)}):")
        for i, loc in enumerate(text_locations[:10], 1):
            print(f"  {i}. '{loc.get('text', '')}' at ({loc.get('x', 0)}, {loc.get('y', 0)}) "
                  f"[conf: {loc.get('confidence', 0)}]")
        
        if len(text_locations) > 10:
            print(f"  ... and {len(text_locations) - 10} more")
        
    except Exception as e:
        print(f"\n✗ OCR analysis failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_ocr.py <image_path>")
        print("Example: python test_ocr.py screenshots/post_1_frame0.jpg")
        sys.exit(1)
    
    image_path = sys.argv[1]
    test_ocr(image_path)

