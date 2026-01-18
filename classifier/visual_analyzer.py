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
            "metadata": self._analyze_metadata(image, img_array),
            "semantic_errors": self._analyze_semantic_errors(img_array, image.size)
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
    
    def _preprocess_for_ocr(self, image: Image.Image) -> Image.Image:
        """
        Preprocess image for better OCR results on TikTok screenshots.
        
        Applies: upscaling, grayscale conversion, denoising, contrast enhancement, sharpening.
        """
        # Convert to numpy array
        img_array = np.array(image.convert("RGB"))
        original_height = img_array.shape[0]
        
        # Upscale if small (helps with small text in video frames)
        if original_height < 300:
            scale_factor = 2.0
            img_array = cv2.resize(
                img_array, None, 
                fx=scale_factor, fy=scale_factor, 
                interpolation=cv2.INTER_CUBIC
            )
        
        # Convert to grayscale (often better for OCR than color)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # Denoise (bilateral filter preserves edges while removing noise)
        denoised = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # CLAHE contrast enhancement (helps with compressed video frames)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        
        # Sharpening (unsharp mask) - helps with video compression blur
        gaussian = cv2.GaussianBlur(enhanced, (0, 0), 2.0)
        sharpened = cv2.addWeighted(enhanced, 1.5, gaussian, -0.5, 0)
        
        # Convert back to PIL Image
        return Image.fromarray(sharpened)
    
    def _analyze_text(self, image: Image.Image) -> Dict[str, Any]:
        """
        Extract text from image using OCR with preprocessing and multiple PSM modes.
        
        Optimized for TikTok video frame screenshots with degraded text quality.
        
        Returns:
            {
                "text_found": str,
                "is_gibberish": bool,
                "text_locations": List[Dict],
                "word_count": int,
                "ocr_confidence": float  # Average confidence from successful detections
            }
        """
        # Preprocess image for better OCR
        preprocessed = self._preprocess_for_ocr(image)
        
        # Try multiple PSM (Page Segmentation Mode) modes and combine results
        # PSM modes for different text layouts in video frames
        psm_modes = [11, 6, 7, 8, 13]  # Sparse text, uniform block, single line, word, raw line
        all_text_parts = []
        all_locations = []
        all_confidences = []
        
        for psm in psm_modes:
            try:
                config = f'--psm {psm}'
                ocr_data = pytesseract.image_to_data(
                    preprocessed, 
                    config=config, 
                    output_type=pytesseract.Output.DICT
                )
                
                # Extract text from this PSM mode
                n_boxes = len(ocr_data['text'])
                for i in range(n_boxes):
                    text = ocr_data['text'][i].strip()
                    conf = int(ocr_data['conf'][i])
                    
                    # Lower threshold for screenshots (video frames have degraded text)
                    # Accept confidence > -1 (all detections, even low confidence)
                    if text and conf > -1:
                        # Store unique text entries (deduplicate by position)
                        text_location_key = (
                            ocr_data['left'][i] if ocr_data['left'][i] != -1 else -1,
                            ocr_data['top'][i] if ocr_data['top'][i] != -1 else -1
                        )
                        
                        # Check if we already have text at this location
                        existing = next(
                            (loc for loc in all_locations 
                             if loc.get('x') == text_location_key[0] and 
                                loc.get('y') == text_location_key[1]),
                            None
                        )
                        
                        if not existing and text_location_key[0] != -1:
                            all_text_parts.append(text)
                            all_confidences.append(conf)
                            
                            all_locations.append({
                                "text": text,
                                "x": ocr_data['left'][i],
                                "y": ocr_data['top'][i],
                                "width": ocr_data['width'][i],
                                "height": ocr_data['height'][i],
                                "confidence": conf
                            })
            except Exception:
                # Continue with next PSM mode if one fails
                continue
        
        # Calculate average OCR confidence (only from positive confidence detections)
        positive_confs = [c for c in all_confidences if c > 0]
        ocr_confidence = float(np.mean(positive_confs)) / 100.0 if positive_confs else 0.0
        
        # Combine all detected text
        text_found = " ".join(all_text_parts)
        word_count = len(all_text_parts)
        
        # Detect gibberish patterns
        is_gibberish = self._detect_gibberish(text_found)
        
        return {
            "text_found": text_found,
            "is_gibberish": bool(is_gibberish),
            "text_locations": all_locations,
            "word_count": int(word_count),
            "ocr_confidence": round(ocr_confidence, 4)
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
    
    def _analyze_semantic_errors(
        self,
        img_array: np.ndarray,
        image_size: Tuple[int, int]
    ) -> Dict[str, Any]:
        """
        Analyze semantic errors in the image (geometry-based, screenshot-resilient).
        
        Focuses on anatomical inconsistencies, perspective violations, lighting issues,
        and spatial relationships rather than texture patterns.
        
        Returns:
            {
                "anatomical_inconsistencies": float (0-1),
                "perspective_violations": float (0-1),
                "lighting_inconsistencies": float (0-1),
                "spatial_errors": float (0-1),
                "text_warping": float (0-1),
                "overall_semantic_score": float (0-1)  # Higher = more errors
            }
        """
        width, height = image_size
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # Initialize scores
        anatomical_score = 0.0
        perspective_score = 0.0
        lighting_score = 0.0
        spatial_score = 0.0
        text_warping_score = 0.0
        
        # 1. Anatomical inconsistencies (face geometry)
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        
        if len(faces) > 0:
            # Simple heuristic: check face proportions
            # Real faces typically have width/height ratio around 0.6-0.8
            for (x, y, w, h) in faces:
                face_ratio = w / h if h > 0 else 1.0
                # If ratio is extreme, might indicate distortion
                if face_ratio < 0.4 or face_ratio > 1.2:
                    anatomical_score += 0.3
        
        anatomical_score = min(anatomical_score, 1.0)
        
        # 2. Perspective violations (vanishing point analysis)
        # Simple check: use edge detection to find strong lines
        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=50, maxLineGap=10)
        
        if lines is not None and len(lines) > 5:
            # Check if lines converge to reasonable vanishing points
            # Too many parallel lines in wrong directions might indicate issues
            angles = []
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi
                angles.append(angle)
            
            # If angles are too uniform or too chaotic, might indicate errors
            if len(angles) > 0:
                angle_variance = np.var(angles)
                if angle_variance < 100:  # Too uniform (unlikely in real scenes)
                    perspective_score = 0.3
                elif angle_variance > 5000:  # Too chaotic (might indicate artifacts)
                    perspective_score = 0.2
        
        # 3. Lighting/shadow inconsistencies
        # Simple check: look for inconsistent shadow directions
        # (This is a simplified heuristic - full implementation would be more complex)
        # For now, use variance in brightness across image regions
        regions = [
            gray[0:height//3, 0:width//3],      # Top-left
            gray[0:height//3, 2*width//3:],     # Top-right
            gray[2*height//3:, 0:width//3],     # Bottom-left
            gray[2*height//3:, 2*width//3:]     # Bottom-right
        ]
        
        region_brightness = [np.mean(region) for region in regions if region.size > 0]
        if len(region_brightness) >= 4:
            brightness_variance = np.var(region_brightness)
            # Very high or very low variance might indicate lighting issues
            if brightness_variance > 3000 or brightness_variance < 100:
                lighting_score = 0.2
        
        # 4. Spatial errors (depth relationships)
        # Simplified: check if foreground/background relationships seem plausible
        # This is a placeholder - full implementation would use depth estimation
        spatial_score = 0.0  # Conservative - no detection yet
        
        # 5. Text warping (geometry inconsistencies in text regions)
        # Check if detected text regions have unusual aspect ratios
        # (Would need OCR results, but this is called before text analysis completes)
        text_warping_score = 0.0  # Will be informed by OCR results if available
        
        # Calculate overall semantic error score (higher = more errors detected)
        overall_score = (
            anatomical_score * 0.3 +
            perspective_score * 0.2 +
            lighting_score * 0.2 +
            spatial_score * 0.15 +
            text_warping_score * 0.15
        )
        
        return {
            "anatomical_inconsistencies": round(anatomical_score, 4),
            "perspective_violations": round(perspective_score, 4),
            "lighting_inconsistencies": round(lighting_score, 4),
            "spatial_errors": round(spatial_score, 4),
            "text_warping": round(text_warping_score, 4),
            "overall_semantic_score": round(overall_score, 4)
        }