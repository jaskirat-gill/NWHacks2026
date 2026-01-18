"""
Screenshot Quality Analyzer

Analyzes screenshot quality and degradation to assess signal reliability.
All inputs are assumed to be TikTok video frame screenshots.
"""

import cv2
import numpy as np
from PIL import Image
from typing import Dict, Any

class ScreenshotAnalyzer:
    """Analyzes screenshot quality and artifacts to determine signal confidence."""
    
    def __init__(self):
        """Initialize screenshot analyzer."""
        pass
    
    def analyze(self, image: Image.Image) -> Dict[str, Any]:
        """
        Analyze screenshot quality and degradation patterns.
        
        Since all inputs are TikTok screenshots, we always return screenshot_confidence=1.0.
        Focus is on assessing signal reliability based on artifact levels.
        
        Args:
            image: PIL Image object (RGB format)
            
        Returns:
            Dictionary with:
                - screenshot_confidence: float (always 1.0 - we know it's a screenshot)
                - signal_confidence: float (0-1) - how reliable are extracted features
                - artifact_levels: Dict with specific artifact scores
                - capture_type: str (always "screen_grab")
        """
        img_array = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        height, width = img_array.shape[:2]
        
        # Analyze artifacts
        compression_artifacts = self._detect_compression_artifacts(gray)
        edge_aliasing = self._detect_edge_aliasing(gray)
        motion_blur = self._detect_motion_blur(gray)
        
        # Calculate signal confidence based on artifact levels
        # Lower artifacts = higher signal confidence
        # Formula: start at 1.0, reduce for each artifact type
        signal_confidence = 1.0
        
        # Compression artifacts reduce signal reliability
        if compression_artifacts > 0.5:
            signal_confidence -= 0.2
        elif compression_artifacts > 0.3:
            signal_confidence -= 0.1
        
        # Edge aliasing reduces geometry analysis reliability
        if edge_aliasing > 0.6:
            signal_confidence -= 0.15
        elif edge_aliasing > 0.4:
            signal_confidence -= 0.08
        
        # Motion blur reduces overall feature extraction reliability
        if motion_blur > 0.7:
            signal_confidence -= 0.2
        elif motion_blur > 0.5:
            signal_confidence -= 0.1
        
        # Clamp to reasonable range (0.3 to 0.9)
        # Even worst screenshots have some signal, best have limitations
        signal_confidence = max(0.3, min(0.9, signal_confidence))
        
        artifact_levels = {
            "compression": round(compression_artifacts, 4),
            "edge_aliasing": round(edge_aliasing, 4),
            "motion_blur": round(motion_blur, 4)
        }
        
        return {
            "screenshot_confidence": 1.0,  # Always a screenshot
            "signal_confidence": round(signal_confidence, 4),
            "artifact_levels": artifact_levels,
            "capture_type": "screen_grab"
        }
    
    def _detect_compression_artifacts(self, gray: np.ndarray) -> float:
        """
        Detect compression artifacts (double compression from TikTok + screenshot).
        
        Uses DCT coefficient analysis to detect block artifacts.
        
        Returns:
            Compression artifact score (0-1), higher = more artifacts
        """
        # Convert to float for DCT
        img_float = gray.astype(np.float32)
        
        # Analyze 8x8 blocks (JPEG compression block size)
        block_size = 8
        height, width = img_float.shape
        
        # Crop to multiple of block_size
        h_crop = (height // block_size) * block_size
        w_crop = (width // block_size) * block_size
        img_cropped = img_float[:h_crop, :w_crop]
        
        # Calculate block variance (compressed blocks have lower variance)
        block_variances = []
        for i in range(0, h_crop - block_size, block_size):
            for j in range(0, w_crop - block_size, block_size):
                block = img_cropped[i:i+block_size, j:j+block_size]
                block_var = np.var(block)
                block_variances.append(block_var)
        
        if not block_variances:
            return 0.0
        
        # Low variance blocks suggest compression artifacts
        avg_variance = np.mean(block_variances)
        # Normalize: very low variance (< 100) indicates compression
        artifact_score = max(0.0, min(1.0, (100 - avg_variance) / 100.0))
        
        return artifact_score
    
    def _detect_edge_aliasing(self, gray: np.ndarray) -> float:
        """
        Detect edge aliasing patterns (hard edges from pixel-level capture).
        
        Returns:
            Aliasing score (0-1), higher = more aliasing
        """
        # Use Canny edge detection
        edges = cv2.Canny(gray, 50, 150)
        
        # Count edge pixels
        edge_pixels = np.sum(edges > 0)
        total_pixels = edges.size
        edge_density = edge_pixels / total_pixels if total_pixels > 0 else 0.0
        
        # High edge density with sharp transitions suggests aliasing
        # Calculate edge sharpness using gradient magnitude
        grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
        
        # High gradient magnitude + high edge density = aliasing
        avg_gradient = np.mean(gradient_magnitude)
        
        # Normalize (high values indicate aliasing)
        aliasing_score = min(1.0, (edge_density * 10 + avg_gradient / 50) / 2.0)
        
        return aliasing_score
    
    def _detect_motion_blur(self, gray: np.ndarray) -> float:
        """
        Detect motion blur from video frame capture.
        
        Uses Laplacian variance - blurred images have lower variance.
        
        Returns:
            Motion blur score (0-1), higher = more blur
        """
        # Calculate Laplacian variance
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Sharp images typically have variance > 500
        # Very blurred images have variance < 100
        # Normalize to 0-1 (inverse: lower variance = higher blur score)
        if laplacian_var > 500:
            blur_score = 0.0
        elif laplacian_var < 100:
            blur_score = 1.0
        else:
            # Linear interpolation
            blur_score = 1.0 - (laplacian_var - 100) / 400.0
        
        return blur_score

