"""
Visual Analysis & Feature Extraction Module

Extracts meaningful features from images to support intent detection and severity scoring.
Includes face detection, OCR, and metadata analysis.
"""

import cv2
import numpy as np
from PIL import Image
import pytesseract
import re
from typing import Dict, Any, List, Tuple

class VisualAnalyzer:
    """Analyzes images to extract visual features for intent detection and risk scoring."""
    
    def __init__(self):
        """Initialize face detection model."""
        # Initialize OpenCV Haar Cascade face detector
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
    
    def analyze(self, image: Image.Image) -> Dict[str, Any]:
        """
        Perform comprehensive visual analysis on an image.
        
        Args:
            image: PIL Image object (RGB format)
            
        Returns:
            Dictionary containing extracted features:
            {
                "faces": {...},
                "text": {...},
                "metadata": {...}
            }
        """
        img_array = np.array(image.convert("RGB"))
        
        results = {
            "faces": self._analyze_faces(img_array, image.size),
            "text": self._analyze_text(image),
            "metadata": self._analyze_metadata(image, img_array)
        }
        
        return results
    
    def _analyze_faces(
        self, 
        img_array: np.ndarray, 
        image_size: Tuple[int, int]
    ) -> Dict[str, Any]:
        """
        Detect and analyze faces in the image using OpenCV Haar Cascade.
        
        Returns:
            {
                "face_count": int,
                "is_portrait": bool,
                "face_quality": float,
                "face_locations": List[Dict]  # normalized coordinates
            }
        """
        width, height = image_size
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # Detect faces
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        face_count = len(faces)
        face_locations = []
        face_qualities = []
        is_centered = False
        
        for (x, y, w, h) in faces:
            # Normalize coordinates (0-1)
            norm_x = x / width
            norm_y = y / height
            norm_w = w / width
            norm_h = h / height
            
            # Calculate center coordinates (normalized)
            center_x = norm_x + norm_w / 2
            center_y = norm_y + norm_h / 2
            
            face_locations.append({
                "x": float(center_x),
                "y": float(center_y),
                "width": float(norm_w),
                "height": float(norm_h)
            })
            
            # Calculate face quality (size-based heuristic)
            face_area = norm_w * norm_h
            face_qualities.append(face_area)
            
            # Check if face is centered (within 30% of image center)
            center_threshold = 0.3
            is_centered = (
                abs(center_x - 0.5) < center_threshold and
                abs(center_y - 0.5) < center_threshold
            )
        
        # Average face quality
        face_quality = float(np.mean(face_qualities)) if face_qualities else 0.0
        
        # Determine if portrait (centered face, takes significant portion of image)
        is_portrait = bool(
            face_count == 1 and 
            is_centered and 
            face_locations[0]["width"] > 0.3 and
            face_locations[0]["height"] > 0.3
        ) if face_count > 0 else False
        
        return {
            "face_count": int(face_count),
            "is_portrait": bool(is_portrait),
            "face_quality": round(face_quality, 4),
            "face_locations": face_locations
        }
    
    def _analyze_text(self, image: Image.Image) -> Dict[str, Any]:
        """
        Extract text from image using OCR and detect gibberish patterns.
        
        Returns:
            {
                "text_found": str,
                "is_gibberish": bool,
                "text_locations": List[Dict],
                "word_count": int
            }
        """
        try:
            # Extract text with OCR
            ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            
            # Extract all text
            text_parts = []
            text_locations = []
            
            n_boxes = len(ocr_data['text'])
            for i in range(n_boxes):
                text = ocr_data['text'][i].strip()
                conf = int(ocr_data['conf'][i])
                
                if text and conf > 0:  # Only include detected text with confidence > 0
                    text_parts.append(text)
                    
                    # Store location info
                    if ocr_data['left'][i] != -1:  # Valid location
                        text_locations.append({
                            "text": text,
                            "x": ocr_data['left'][i],
                            "y": ocr_data['top'][i],
                            "width": ocr_data['width'][i],
                            "height": ocr_data['height'][i],
                            "confidence": conf
                        })
            
            text_found = " ".join(text_parts)
            word_count = len(text_parts)
            
            # Detect gibberish patterns
            is_gibberish = self._detect_gibberish(text_found)
            
        except Exception:
            # If OCR fails, return empty results
            text_found = ""
            is_gibberish = False
            text_locations = []
            word_count = 0
        
        return {
            "text_found": text_found,
            "is_gibberish": bool(is_gibberish),
            "text_locations": text_locations,
            "word_count": int(word_count)
        }
    
    def _detect_gibberish(self, text: str) -> bool:
        """
        Detect if text appears to be gibberish/garbled.
        
        Heuristics:
        - Excessive repeating characters (e.g., "aaaaaa")
        - Too many special characters relative to letters
        - Very short words mixed with very long words unusually
        - Patterns that don't match natural language
        """
        if not text or len(text.strip()) < 3:
            return False
        
        # Check for excessive repeating characters (more than 4 in a row)
        if re.search(r'(.)\1{4,}', text):
            return True
        
        # Check ratio of alphabetic characters to total
        alpha_count = sum(c.isalpha() for c in text)
        total_chars = len([c for c in text if not c.isspace()])
        
        if total_chars > 0:
            alpha_ratio = alpha_count / total_chars
            # If less than 30% alphabetic, likely gibberish (allowing for numbers)
            if alpha_ratio < 0.3:
                return True
        
        # Check for unusual word patterns
        words = text.split()
        if len(words) > 5:
            word_lengths = [len(w) for w in words if w.isalnum()]
            if word_lengths:
                avg_length = np.mean(word_lengths)
                # Very short average (likely nonsense) or very long (might be garbled)
                if avg_length < 2.5 or avg_length > 15:
                    return True
        
        return False
    
    def _analyze_metadata(
        self, 
        image: Image.Image, 
        img_array: np.ndarray
    ) -> Dict[str, Any]:
        """
        Analyze basic image properties and quality metrics.
        
        Returns:
            {
                "width": int,
                "height": int,
                "format": str,
                "quality_score": float,
                "color_channels": int,
                "has_compression_artifacts": bool
            }
        """
        width, height = image.size
        format_name = image.format or "UNKNOWN"
        color_channels = len(image.getbands())
        
        # Calculate quality score (simple heuristic based on resolution and sharpness)
        total_pixels = width * height
        resolution_score = min(total_pixels / (1920 * 1080), 1.0)  # Normalize to 1080p
        
        # Simple sharpness estimate using Laplacian variance
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        # Normalize sharpness (very sharp images might have variance > 1000)
        sharpness_score = min(laplacian_var / 500.0, 1.0)
        
        quality_score = (resolution_score * 0.6 + sharpness_score * 0.4)
        
        # Simple compression artifact detection
        has_compression_artifacts = False
        if image.format in ['JPEG', 'JPG']:
            # If quality is lower and image is small, likely compressed
            if quality_score < 0.3 and total_pixels < 500000:
                has_compression_artifacts = True
        
        return {
            "width": int(width),
            "height": int(height),
            "format": str(format_name),
            "quality_score": round(quality_score, 4),
            "color_channels": int(color_channels),
            "has_compression_artifacts": bool(has_compression_artifacts)
        }