"""
Unified AI Image Detection Pipeline

Orchestrates all detection components into a single cohesive pipeline.
"""

from typing import Dict, Any
import logging

from classifier import Classifier
from visual_analyzer import VisualAnalyzer
from intent_detector import IntentDetector
from severity_calculator import SeverityCalculator
from models import DetectionResult
from PIL import Image
import io

logger = logging.getLogger(__name__)

class AIImageDetector:
    """
    Unified AI image detector that combines ML classification, visual analysis,
    intent detection, and severity calculation.
    """
    
    def __init__(self):
        """Initialize all detection components."""
        logger.info("Initializing AI Image Detector components...")
        
        self.classifier = Classifier()
        logger.info("  ✓ Classifier initialized")
        
        self.visual_analyzer = VisualAnalyzer()
        logger.info("  ✓ Visual analyzer initialized")
        
        self.intent_detector = IntentDetector()
        logger.info("  ✓ Intent detector initialized")
        
        self.severity_calculator = SeverityCalculator()
        logger.info("  ✓ Severity calculator initialized")
        
        logger.info("AI Image Detector initialized successfully")
    
    def analyze(self, image_bytes: bytes) -> DetectionResult:
        """
        Complete detection pipeline: classify → analyze → detect intent → calculate severity.
        
        Args:
            image_bytes: Raw image bytes
        
        Returns:
            DetectionResult with complete analysis
        
        Raises:
            Exception: If any critical stage fails
        """
        # Step 1: ML Classification
        logger.debug("Running ML classifier...")
        try:
            classifier_result = self.classifier.predict(image_bytes)
            logger.debug(f"Classification: {classifier_result['label']} ({classifier_result['confidence']:.4f})")
        except Exception as e:
            logger.error(f"Classifier failed: {str(e)}", exc_info=True)
            raise Exception(f"Image classification failed: {str(e)}")
        
        # Step 2: Visual Analysis
        logger.debug("Running visual analysis...")
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            visual_features = self.visual_analyzer.analyze(image)
            logger.debug(f"Visual analysis: {visual_features['faces']['face_count']} face(s), "
                        f"{visual_features['text']['word_count']} words")
        except Exception as e:
            logger.warning(f"Visual analysis failed: {str(e)}", exc_info=True)
            # Continue with empty features - severity calculator can handle this
            visual_features = {
                "faces": {"face_count": 0, "is_portrait": False, "face_quality": 0.0, "face_locations": []},
                "text": {"text_found": "", "is_gibberish": False, "text_locations": [], "word_count": 0},
                "metadata": {"width": 0, "height": 0, "format": "UNKNOWN", "quality_score": 0.0, 
                            "color_channels": 3, "has_compression_artifacts": False}
            }
        
        # Step 3: Intent Detection
        logger.debug("Running intent detection...")
        try:
            intent_analysis = self.intent_detector.detect_intent(visual_features)
            logger.debug(f"Intent: {intent_analysis['content_type']}, risk_score: {intent_analysis['risk_score']:.4f}")
        except Exception as e:
            logger.warning(f"Intent detection failed: {str(e)}", exc_info=True)
            # Continue with default intent - severity calculator can handle this
            intent_analysis = {
                "content_type": "other",
                "content_confidence": 0.5,
                "deception_indicators": [],
                "style": "mixed",
                "realism_score": 0.5,
                "risk_score": 0.0,
                "risk_factors": {}
            }
        
        # Step 4: Severity Calculation
        logger.debug("Calculating severity...")
        try:
            detection_result = self.severity_calculator.calculate(
                classifier_result=classifier_result,
                visual_features=visual_features,
                intent_analysis=intent_analysis
            )
            logger.debug(f"Severity: {detection_result.severity}")
        except Exception as e:
            logger.error(f"Severity calculation failed: {str(e)}", exc_info=True)
            raise Exception(f"Severity calculation failed: {str(e)}")
        
        logger.info(f"Detection complete: {detection_result.severity} severity "
                   f"({'AI' if detection_result.is_ai else 'Human'}, "
                   f"{detection_result.confidence:.0%} confidence)")
        
        return detection_result
