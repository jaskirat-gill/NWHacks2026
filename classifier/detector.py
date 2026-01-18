"""
Unified AI Image Detection Pipeline

Orchestrates all detection components into a single cohesive pipeline.
"""

from typing import Dict, Any, List, Union
import logging
import os

from classifier import Classifier
from visual_analyzer import VisualAnalyzer
from intent_detector import IntentDetector
from severity_calculator import SeverityCalculator
from screenshot_analyzer import ScreenshotAnalyzer
from context_loss_calculator import ContextLossCalculator
from multi_frame_analyzer import MultiFrameAnalyzer
from gemini_analyzer import GeminiAnalyzer
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
        
        self.screenshot_analyzer = ScreenshotAnalyzer()
        logger.info("  ✓ Screenshot analyzer initialized")
        
        self.classifier = Classifier()
        logger.info("  ✓ Classifier initialized")
        
        self.visual_analyzer = VisualAnalyzer()
        logger.info("  ✓ Visual analyzer initialized")
        
        self.intent_detector = IntentDetector()
        logger.info("  ✓ Intent detector initialized")
        
        self.context_loss_calculator = ContextLossCalculator()
        logger.info("  ✓ Context loss calculator initialized")
        
        self.severity_calculator = SeverityCalculator()
        logger.info("  ✓ Severity calculator initialized")
        
        # Initialize multi-frame and Gemini analyzers (optional - only for multi-frame processing)
        self.multi_frame_analyzer = None  # Will be initialized if needed
        
        # Initialize Gemini analyzer for classification (lazy initialization)
        self.gemini_analyzer = None
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if gemini_api_key:
            try:
                self.gemini_analyzer = GeminiAnalyzer(api_key=gemini_api_key)
                logger.info("  ✓ Gemini analyzer initialized for classification")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini analyzer: {str(e)}")
        else:
            logger.warning("GEMINI_API_KEY not set, Gemini classification will be disabled")
        
        logger.info("AI Image Detector initialized successfully")
    
    def analyze(self, image_bytes: Union[bytes, List[bytes]]) -> DetectionResult:
        """
        Complete detection pipeline for TikTok screenshot analysis.
        
        Handles both single frame and multi-frame (5 frames) processing.
        For 5 frames: processes via our pipeline, gets Gemini analysis, and combines (30% us, 70% Gemini).
        
        Pipeline (single frame):
        1. Screenshot quality analysis
        2. SDXL aesthetic similarity classification
        3. Improved OCR + Visual semantic analysis
        4. Hypothesis-based intent detection
        5. Context loss calculation
        6. Severity calculation with caps and constraints
        
        Pipeline (5 frames):
        1. Process all 5 frames via our pipeline → our_analysis (30%)
        2. Send 5 frames to Gemini → gemini_analysis (70%)
        3. Combine results with weighted average
        
        Args:
            image_bytes: Raw image bytes (single frame) or List[bytes] (5 frames)
        
        Returns:
            DetectionResult with complete analysis
        
        Raises:
            Exception: If any critical stage fails
        """
        # Handle multi-frame processing
        if isinstance(image_bytes, list):
            if len(image_bytes) == 1:
                # Single frame in list - extract it
                image_bytes = image_bytes[0]
            else:
                raise ValueError(f"Expected 1 frame, but received {len(image_bytes)}")
        
        # Single frame processing (original logic)
        # Convert bytes to PIL Image (reused across stages)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Step 0: Screenshot Quality Analysis (mandatory first stage)
        logger.debug("Analyzing screenshot quality...")
        try:
            screenshot_result = self.screenshot_analyzer.analyze(image)
            signal_confidence = screenshot_result.get("signal_confidence", 0.7)
            screenshot_confidence = screenshot_result.get("screenshot_confidence", 1.0)
            logger.debug(f"Screenshot analysis: signal_confidence={signal_confidence:.4f}")
        except Exception as e:
            logger.warning(f"Screenshot analysis failed: {str(e)}", exc_info=True)
            # Default values if analysis fails
            signal_confidence = 0.7
            screenshot_confidence = 1.0
            screenshot_result = {
                "screenshot_confidence": screenshot_confidence,
                "signal_confidence": signal_confidence,
                "artifact_levels": {}
            }
        
        # Step 1: SDXL Aesthetic Similarity Classification
        logger.debug("Running SDXL classifier (aesthetic similarity)...")
        try:
            classifier_result = self.classifier.predict(image_bytes)
            aesthetic_similarity_score = classifier_result.get("aesthetic_similarity_score", 0.0)
            logger.debug(f"Aesthetic similarity: {aesthetic_similarity_score:.4f}")
        except Exception as e:
            logger.error(f"Classifier failed: {str(e)}", exc_info=True)
            raise Exception(f"Image classification failed: {str(e)}")
        
        # Step 1b: Get Gemini classification (70% weight)
        gemini_classification = None
        if self.gemini_analyzer:
            logger.debug("Getting Gemini classification...")
            try:
                gemini_classification = self.gemini_analyzer.classify_image(image_bytes)
                logger.debug(f"Gemini classification: is_ai={gemini_classification.get('is_ai_likely')}, "
                           f"confidence={gemini_classification.get('confidence', 0.0):.4f}")
            except Exception as e:
                logger.warning(f"Gemini classification failed: {str(e)}, continuing without it")
                gemini_classification = None
        
        # Step 1c: Combine classifier results with 70/30 weighting (70% Gemini, 30% SDXL)
        if gemini_classification:
            gemini_weight = 0.7
            sdxl_weight = 0.3
            
            # Combine aesthetic similarity scores
            gemini_aesthetic = gemini_classification.get("aesthetic_similarity", aesthetic_similarity_score)
            combined_aesthetic_similarity = (
                gemini_aesthetic * gemini_weight +
                aesthetic_similarity_score * sdxl_weight
            )
            
            # Update the aesthetic_similarity_score for downstream processing
            aesthetic_similarity_score = combined_aesthetic_similarity
            
            # Update classifier_result with combined values for severity calculation
            # We'll also store Gemini's confidence for potential use
            classifier_result["gemini_classification"] = gemini_classification
            classifier_result["combined_aesthetic_similarity"] = combined_aesthetic_similarity
            
            logger.debug(f"Combined aesthetic similarity (70% Gemini, 30% SDXL): {combined_aesthetic_similarity:.4f}")
        else:
            # No Gemini, use SDXL only
            logger.debug("Using SDXL classification only (Gemini unavailable)")
            classifier_result["combined_aesthetic_similarity"] = aesthetic_similarity_score
        
        # Step 2: Visual Analysis (improved OCR + semantic errors)
        logger.debug("Running visual analysis...")
        try:
            visual_features = self.visual_analyzer.analyze(image)
            ocr_confidence = visual_features.get("text", {}).get("ocr_confidence", 0.5)
            logger.debug(f"Visual analysis: {visual_features['faces']['face_count']} face(s), "
                        f"{visual_features['text']['word_count']} words, OCR confidence={ocr_confidence:.4f}")
        except Exception as e:
            logger.warning(f"Visual analysis failed: {str(e)}", exc_info=True)
            # Continue with empty features
            visual_features = {
                "faces": {"face_count": 0, "is_portrait": False, "face_quality": 0.0, "face_locations": []},
                "text": {"text_found": "", "is_gibberish": False, "text_locations": [], "word_count": 0, "ocr_confidence": 0.5},
                "metadata": {"width": 0, "height": 0, "format": "UNKNOWN", "quality_score": 0.0, 
                            "color_channels": 3, "has_compression_artifacts": False},
                "semantic_errors": {"overall_semantic_score": 0.0}
            }
            ocr_confidence = 0.5
        
        # EARLY EXIT: Check OCR text for AI-related keywords
        text_found = visual_features.get("text", {}).get("text_found", "").lower()
        ai_keywords = ["sora", "invideo", "fake", "ai", "artificial intelligence", "generated", "deepfake"]
        
        detected_keyword = None
        for keyword in ai_keywords:
            if keyword in text_found:
                detected_keyword = keyword
                break
        
        if detected_keyword:
            logger.info(f"EARLY EXIT: AI keyword '{detected_keyword}' detected in OCR text. Marking as AI immediately.")
            # Return immediate AI detection result
            return DetectionResult(
                is_ai=True,
                confidence=0.95,  # High confidence due to explicit keyword
                severity="HIGH",
                reasons=[
                    "Based on a single TikTok video frame screenshot (no UI elements)...",
                    "Without platform context or temporal information...",
                    f"OCR detected AI-related keyword '{detected_keyword}' in image text, indicating AI-generated content.",
                    "This assessment may change with additional context."
                ],
                risk_factors={
                    "early_exit_trigger": "ocr_keyword_match",
                    "detected_keyword": detected_keyword,
                    "content_type": "other"
                },
                classifier_scores={},
                screenshot_confidence=1.0,
                signal_confidence=signal_confidence,
                aesthetic_similarity_score=0.95,  # Assume high similarity when keyword is present
                context_loss_penalty=0.3,
                plausible_intents=[{
                    "intent": "ai_generated",
                    "likelihood": 0.95,
                    "uncertainty": 0.05,
                    "evidence": [f"Keyword '{detected_keyword}' detected in text"]
                }]
            )
        
        # Step 3: Hypothesis-Based Intent Detection
        logger.debug("Running intent detection...")
        try:
            intent_analysis = self.intent_detector.detect_intent(
                features=visual_features,
                signal_confidence=signal_confidence
            )
            plausible_intents = intent_analysis.get("plausible_intents", [])
            logger.debug(f"Intent: {intent_analysis['content_type']}, {len(plausible_intents)} plausible intents")
        except Exception as e:
            logger.warning(f"Intent detection failed: {str(e)}", exc_info=True)
            # Continue with default intent
            intent_analysis = {
                "content_type": "other",
                "content_confidence": 0.5,
                "deception_indicators": [],
                "style": "mixed",
                "realism_score": 0.5,
                "risk_factors": {},
                "plausible_intents": []
            }
            plausible_intents = []
        
        # Step 4: Context Loss Calculation
        logger.debug("Calculating context loss penalty...")
        try:
            context_loss_result = self.context_loss_calculator.calculate(
                signal_confidence=signal_confidence,
                ocr_confidence=ocr_confidence
            )
            context_loss_penalty = context_loss_result.get("context_loss_penalty", 0.3)
            logger.debug(f"Context loss penalty: {context_loss_penalty:.4f}")
        except Exception as e:
            logger.warning(f"Context loss calculation failed: {str(e)}", exc_info=True)
            context_loss_result = {
                "context_loss_penalty": 0.3,
                "max_achievable_confidence": 0.91,
                "factors": {}
            }
        
        # Step 5: Severity Calculation (with SDXL caps and strict HIGH requirements)
        logger.debug("Calculating severity...")
        try:
            detection_result = self.severity_calculator.calculate(
                classifier_result=classifier_result,
                visual_features=visual_features,
                intent_analysis=intent_analysis,
                aesthetic_similarity_score=aesthetic_similarity_score,
                plausible_intents=plausible_intents,
                context_loss_result=context_loss_result,
                signal_confidence=signal_confidence
            )
            
            # Apply 70/30 weighting to final confidence and is_ai if Gemini classification is available
            if gemini_classification:
                gemini_weight = 0.7
                sdxl_weight = 0.3
                
                # Combine confidence scores
                gemini_conf = gemini_classification.get("confidence", detection_result.confidence)
                combined_confidence = (
                    gemini_conf * gemini_weight +
                    detection_result.confidence * sdxl_weight
                )
                
                # Weighted vote for is_ai (Gemini's opinion is 70% weight)
                gemini_is_ai = gemini_classification.get("is_ai_likely", detection_result.is_ai)
                # If Gemini is very confident (>0.6), use its decision; otherwise weighted vote
                if gemini_conf > 0.6:
                    combined_is_ai = gemini_is_ai
                else:
                    # Weighted vote: if either classifier strongly agrees, use that
                    combined_is_ai = gemini_is_ai if gemini_weight > 0.5 else detection_result.is_ai
                
                # Update the detection result with combined values
                detection_result.confidence = round(combined_confidence, 4)
                detection_result.is_ai = combined_is_ai
                detection_result.aesthetic_similarity_score = round(aesthetic_similarity_score, 4)
                
                logger.debug(f"Combined result (70% Gemini, 30% SDXL): is_ai={combined_is_ai}, "
                           f"confidence={combined_confidence:.4f}")
            
            logger.debug(f"Severity: {detection_result.severity}")
        except Exception as e:
            logger.error(f"Severity calculation failed: {str(e)}", exc_info=True)
            raise Exception(f"Severity calculation failed: {str(e)}")
        
        logger.info(f"Detection complete: {detection_result.severity} severity "
                   f"({'AI' if detection_result.is_ai else 'Human'}, "
                   f"aesthetic similarity: {detection_result.aesthetic_similarity_score:.0%}, "
                   f"confidence: {detection_result.confidence:.0%})")
        
        return detection_result
    
    def _analyze_multi_frame(self, image_bytes_list: List[bytes]) -> DetectionResult:
        """
        Process 5 frames: combine our analysis (30%) with Gemini's analysis (70%).
        
        Args:
            image_bytes_list: List of 10 image bytes
        
        Returns:
            Combined DetectionResult
        """
        logger.info("Processing 5 frames with multi-frame pipeline...")
        
        # Initialize analyzers if not already initialized
        if self.multi_frame_analyzer is None:
            self.multi_frame_analyzer = MultiFrameAnalyzer(self)
        
        # Step 1: Process via our pipeline (30% weight)
        logger.info("Step 1: Processing frames via our pipeline...")
        try:
            our_analysis = self.multi_frame_analyzer.analyze_frames(image_bytes_list)
            logger.info(f"Our analysis: severity={our_analysis.severity}, confidence={our_analysis.confidence:.4f}")
        except Exception as e:
            logger.error(f"Our multi-frame analysis failed: {str(e)}", exc_info=True)
            raise Exception(f"Multi-frame analysis failed: {str(e)}")
        
        # Step 2: Get Gemini analysis (70% weight) - TEMPORARILY DISABLED
        # logger.info("Step 2: Getting Gemini analysis...")
        # gemini_analysis = None
        # try:
        #     if self.gemini_analyzer is None:
        #         api_key = os.getenv("GEMINI_API_KEY")
        #         if api_key:
        #             self.gemini_analyzer = GeminiAnalyzer(api_key=api_key)
        #         else:
        #             logger.warning("GEMINI_API_KEY not set, skipping Gemini analysis")
        #     
        #     if self.gemini_analyzer:
        #         gemini_result = self.gemini_analyzer.analyze_frames(image_bytes_list)
        #         logger.info(f"Gemini analysis: severity={gemini_result.get('severity')}, "
        #                   f"confidence={gemini_result.get('confidence', 0.0):.4f}")
        #         gemini_analysis = gemini_result
        # except Exception as e:
        #     logger.warning(f"Gemini analysis failed: {str(e)}, falling back to our analysis only")
        #     # Continue with our analysis only (100% weight)
        
        # Step 3: Combine results - TEMPORARILY USING OUR ANALYSIS ONLY
        # if gemini_analysis:
        #     logger.info("Step 3: Combining our analysis (30%) with Gemini (70%)...")
        #     final_result = self._combine_analyses(our_analysis, gemini_analysis)
        # else:
        #     logger.info("Using our analysis only (Gemini unavailable)")
        #     final_result = our_analysis
        
        # Use our analysis only (Gemini disabled)
        logger.info("Using our analysis only (Gemini temporarily disabled)")
        final_result = our_analysis
        
        logger.info(f"Final combined result: severity={final_result.severity}, "
                   f"confidence={final_result.confidence:.4f}")
        
        return final_result
    
    def _combine_analyses(
        self, 
        our_analysis: DetectionResult, 
        gemini_analysis: Dict[str, Any]
    ) -> DetectionResult:
        """
        Combine our analysis (30%) with Gemini's analysis (70%).
        
        Args:
            our_analysis: DetectionResult from our pipeline
            gemini_analysis: Dictionary from Gemini API
        
        Returns:
            Combined DetectionResult
        """
        our_weight = 0.3
        gemini_weight = 0.7
        
        # Weighted average for numeric scores
        combined_confidence = (
            our_analysis.confidence * our_weight +
            gemini_analysis.get("confidence", 0.5) * gemini_weight
        )
        
        combined_aesthetic_similarity = (
            our_analysis.aesthetic_similarity_score * our_weight +
            gemini_analysis.get("aesthetic_similarity", 0.5) * gemini_weight
        )
        
        # Use Gemini's severity as primary (70% weight), fallback to ours
        gemini_severity = gemini_analysis.get("severity", "UNCERTAIN")
        if gemini_severity in ["LOW", "MEDIUM", "HIGH", "UNCERTAIN"]:
            combined_severity = gemini_severity
        else:
            combined_severity = our_analysis.severity
        
        # Use Gemini's is_ai if confidence is high, else weighted vote
        gemini_is_ai = gemini_analysis.get("is_ai_likely", False)
        gemini_conf = gemini_analysis.get("confidence", 0.5)
        if gemini_conf > 0.6:
            combined_is_ai = gemini_is_ai
        else:
            # Weighted vote
            combined_is_ai = (our_analysis.is_ai and our_weight > 0.5) or (gemini_is_ai and gemini_weight > 0.5)
        
        # Combine reasons: Gemini's first (weighted more), then ours
        combined_reasons = []
        gemini_indicators = gemini_analysis.get("indicators", [])
        gemini_explanation = gemini_analysis.get("explanation", "")
        
        # Add Gemini's explanation and indicators first
        if gemini_explanation:
            combined_reasons.append(f"[Gemini] {gemini_explanation}")
        for indicator in gemini_indicators[:5]:  # Top 5 from Gemini
            combined_reasons.append(f"[Gemini] {indicator}")
        
        # Add our reasons (avoid duplicates)
        our_reasons = our_analysis.reasons[:5]  # Top 5 from ours
        for reason in our_reasons:
            # Skip if too similar to Gemini reasons
            if not any(indicator.lower() in reason.lower() for indicator in gemini_indicators):
                combined_reasons.append(f"[Our Analysis] {reason}")
        
        # Combine plausible_intents (use Gemini's if available, else ours)
        combined_intents = our_analysis.plausible_intents
        # Could enhance this to merge intent likelihoods, but for now use ours
        
        # Create combined result
        combined_result = DetectionResult(
            is_ai=combined_is_ai,
            confidence=round(combined_confidence, 4),
            severity=combined_severity,
            reasons=combined_reasons,
            risk_factors=our_analysis.risk_factors,  # Keep our risk factors
            classifier_scores=our_analysis.classifier_scores,  # Keep our classifier scores
            screenshot_confidence=our_analysis.screenshot_confidence,
            signal_confidence=our_analysis.signal_confidence,  # Keep our signal confidence
            aesthetic_similarity_score=round(combined_aesthetic_similarity, 4),
            context_loss_penalty=our_analysis.context_loss_penalty,  # Keep our context loss
            plausible_intents=combined_intents
        )
        
        return combined_result
