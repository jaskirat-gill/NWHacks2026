"""
Multi-Frame Analyzer

Processes 10 frames individually and combines results via voting and averaging.
"""

from typing import List
from collections import Counter
import logging
from models import DetectionResult
from detector import AIImageDetector

logger = logging.getLogger(__name__)

class MultiFrameAnalyzer:
    """Processes multiple frames and combines results."""
    
    def __init__(self, detector: AIImageDetector):
        """
        Initialize multi-frame analyzer.
        
        Args:
            detector: AIImageDetector instance to process individual frames
        """
        self.detector = detector
    
    def analyze_frames(self, image_bytes_list: List[bytes]) -> DetectionResult:
        """
        Process 10 frames individually and combine results.
        
        Args:
            image_bytes_list: List of 10 image bytes
        
        Returns:
            Combined DetectionResult with voted severity and averaged scores
        """
        if len(image_bytes_list) != 10:
            raise ValueError(f"Expected exactly 10 frames, but received {len(image_bytes_list)}")
        
        logger.info(f"Processing {len(image_bytes_list)} frames individually...")
        
        # Process each frame individually
        frame_results = []
        for i, image_bytes in enumerate(image_bytes_list):
            try:
                result = self.detector.analyze(image_bytes)
                frame_results.append(result)
                logger.debug(f"Frame {i+1}/10: severity={result.severity}, confidence={result.confidence:.4f}")
            except Exception as e:
                logger.warning(f"Frame {i+1}/10 processing failed: {str(e)}", exc_info=True)
                # Continue with other frames - we'll handle incomplete results
        
        if not frame_results:
            raise Exception("All frames failed to process")
        
        logger.info(f"Successfully processed {len(frame_results)}/{len(image_bytes_list)} frames")
        
        # Combine results
        combined = self._combine_results(frame_results)
        
        return combined
    
    def _combine_results(self, frame_results: List[DetectionResult]) -> DetectionResult:
        """
        Combine multiple DetectionResult objects via voting and averaging.
        
        Args:
            frame_results: List of DetectionResult from individual frames
        
        Returns:
            Combined DetectionResult
        """
        # Voting: Collect severity levels and determine majority
        severities = [r.severity for r in frame_results]
        severity_counts = Counter(severities)
        majority_severity = severity_counts.most_common(1)[0][0]
        
        # Tie-breaking order: HIGH > MEDIUM > UNCERTAIN > LOW
        if len(severity_counts) > 1:
            # Check if there's a tie at the top
            most_common_count = severity_counts.most_common(1)[0][1]
            ties = [sev for sev, count in severity_counts.items() if count == most_common_count]
            if len(ties) > 1:
                # Apply tie-breaking priority
                priority = {"HIGH": 4, "MEDIUM": 3, "UNCERTAIN": 2, "LOW": 1}
                majority_severity = max(ties, key=lambda s: priority.get(s, 0))
        
        # Average numeric scores
        avg_confidence = sum(r.confidence for r in frame_results) / len(frame_results)
        avg_aesthetic_similarity = sum(r.aesthetic_similarity_score for r in frame_results) / len(frame_results)
        avg_signal_confidence = sum(r.signal_confidence for r in frame_results) / len(frame_results)
        avg_context_loss_penalty = sum(r.context_loss_penalty for r in frame_results) / len(frame_results)
        
        # Vote on is_ai (majority)
        ai_votes = sum(1 for r in frame_results if r.is_ai)
        majority_is_ai = ai_votes > len(frame_results) / 2
        
        # Combine plausible_intents from all frames
        all_intents = []
        intent_likelihoods = {}  # Track max likelihood per intent type across frames
        for result in frame_results:
            for intent in result.plausible_intents:
                intent_type = intent.get("intent", "other")
                likelihood = intent.get("likelihood", 0.0)
                uncertainty = intent.get("uncertainty", 0.5)
                
                # Track maximum likelihood per intent type
                if intent_type not in intent_likelihoods:
                    intent_likelihoods[intent_type] = {
                        "likelihood": likelihood,
                        "uncertainty": uncertainty,
                        "evidence": intent.get("evidence", [])
                    }
                else:
                    if likelihood > intent_likelihoods[intent_type]["likelihood"]:
                        intent_likelihoods[intent_type] = {
                            "likelihood": likelihood,
                            "uncertainty": uncertainty,
                            "evidence": intent.get("evidence", [])
                        }
        
        # Convert intent_likelihoods back to list format
        combined_intents = [
            {
                "intent": intent_type,
                "likelihood": round(data["likelihood"], 4),
                "uncertainty": round(data["uncertainty"], 4),
                "evidence": data["evidence"][:3]  # Limit evidence to top 3
            }
            for intent_type, data in intent_likelihoods.items()
        ]
        # Sort by likelihood descending
        combined_intents.sort(key=lambda x: x["likelihood"], reverse=True)
        
        # Combine reasons (collect unique reasons from all frames)
        all_reasons = []
        seen_reasons = set()
        for result in frame_results:
            for reason in result.reasons:
                # Normalize reason text for deduplication
                reason_key = reason.lower().strip()
                if reason_key not in seen_reasons:
                    seen_reasons.add(reason_key)
                    all_reasons.append(reason)
        
        # Keep top reasons (limit to avoid overwhelming output)
        combined_reasons = all_reasons[:10]  # Top 10 unique reasons
        
        # Combine classifier_scores (average probabilities)
        all_classifier_scores = {}
        score_counts = {}
        for result in frame_results:
            for label, score in result.classifier_scores.items():
                if label not in all_classifier_scores:
                    all_classifier_scores[label] = 0.0
                    score_counts[label] = 0
                all_classifier_scores[label] += score
                score_counts[label] += 1
        
        combined_classifier_scores = {
            label: score / score_counts[label]
            for label, score in all_classifier_scores.items()
        }
        
        # Combine risk_factors (use first frame's structure, but could average if needed)
        combined_risk_factors = frame_results[0].risk_factors.copy() if frame_results else {}
        
        # Use first frame as template, update with averaged/combined values
        template = frame_results[0]
        
        combined_result = DetectionResult(
            is_ai=majority_is_ai,
            confidence=round(avg_confidence, 4),
            severity=majority_severity,
            reasons=combined_reasons,
            risk_factors=combined_risk_factors,
            classifier_scores=combined_classifier_scores,
            screenshot_confidence=1.0,  # Always 1.0 for screenshots
            signal_confidence=round(avg_signal_confidence, 4),
            aesthetic_similarity_score=round(avg_aesthetic_similarity, 4),
            context_loss_penalty=round(avg_context_loss_penalty, 4),
            plausible_intents=combined_intents
        )
        
        logger.info(f"Combined result: severity={majority_severity}, "
                   f"confidence={avg_confidence:.4f}, "
                   f"aesthetic_similarity={avg_aesthetic_similarity:.4f}")
        
        return combined_result

