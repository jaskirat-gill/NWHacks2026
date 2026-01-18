"""
Severity Calculation Module

Combines ML classifier results with intent analysis to determine severity
and generate human-readable reasons.
"""

from typing import Dict, Any, List
from models import DetectionResult

class SeverityCalculator:
    """Calculates severity levels and generates human-readable reasons."""
    
    # Severity thresholds
    HIGH_SEVERITY_THRESHOLD = 0.7
    MEDIUM_SEVERITY_THRESHOLD = 0.4
    
    # Risk score multipliers based on content type
    CONTENT_TYPE_MULTIPLIERS = {
        "portrait": 1.2,    # Portraits are riskier (catfishing)
        "product": 1.0,     # Neutral
        "document": 1.3,    # Documents are riskier (phishing)
        "artistic": 0.6,    # Artistic images are less risky
        "scenic": 0.5,      # Scenic images are less risky
        "other": 1.0
    }
    
    def calculate(
        self,
        classifier_result: Dict[str, Any],
        visual_features: Dict[str, Any],
        intent_analysis: Dict[str, Any],
        aesthetic_similarity_score: float,
        plausible_intents: List[Dict[str, Any]],
        context_loss_result: Dict[str, Any],
        signal_confidence: float
    ) -> DetectionResult:
        """
        Calculate severity with SDXL caps, context loss penalty, and strict HIGH requirements.
        
        Args:
            classifier_result: Output from Classifier.predict()
            visual_features: Output from VisualAnalyzer.analyze()
            intent_analysis: Output from IntentDetector.detect_intent()
            aesthetic_similarity_score: SDXL aesthetic similarity (0-1), max 30% origin, 20% severity
            plausible_intents: Hypothesis-based intent detection results
            context_loss_result: Output from ContextLossCalculator.calculate()
            signal_confidence: How reliable are extracted features (0-1)
        
        Returns:
            DetectionResult with severity, reasons, and all analysis data
        """
        classifier_scores = classifier_result.get("scores", {})
        content_type = intent_analysis.get("content_type", "other")
        deception_indicators = intent_analysis.get("deception_indicators", [])
        risk_factors = intent_analysis.get("risk_factors", {})
        style = intent_analysis.get("style", "mixed")
        context_loss_penalty = context_loss_result.get("context_loss_penalty", 0.3)
        max_achievable_confidence = context_loss_result.get("max_achievable_confidence", 0.91)
        
        # SDXL CAP #1: Aesthetic similarity contributes max 30% to AI-origin confidence
        # is_ai is determined by aesthetic similarity threshold (>0.5), but confidence is capped
        is_ai = aesthetic_similarity_score > 0.5
        ai_confidence_from_similarity = aesthetic_similarity_score * 0.3
        
        # Other signals contribute 70% (visual features, semantic errors, etc.)
        # For now, use aesthetic similarity for is_ai determination
        # In future, could combine with semantic error scores
        
        # Apply context loss penalty to confidence
        # Cap confidence at max_achievable_confidence
        raw_confidence = classifier_result.get("confidence", 0.0)
        confidence = min(raw_confidence, max_achievable_confidence)
        
        # SDXL CAP #2: Aesthetic similarity contributes max 20% to severity
        # Get deception likelihood from plausible_intents
        deception_likelihood = 0.0
        for intent in plausible_intents:
            if intent.get("intent") in ["impersonation", "promotion"]:
                deception_likelihood = max(deception_likelihood, intent.get("likelihood", 0.0))
        
        # Count deception indicators as additional signal
        deception_strength = min(len(deception_indicators) / 5.0, 1.0)  # Normalize to 0-1
        
        # Severity calculation: SDXL max 20%, intent/deception 50%, other 30%
        base_severity = (
            aesthetic_similarity_score * 0.2 +  # SDXL capped at 20%
            deception_likelihood * 0.3 +
            deception_strength * 0.2 +
            0.3  # Base from other signals (placeholder)
        )
        
        # Check for human identity (required for HIGH severity)
        faces = visual_features.get("faces", {})
        has_human_identity = faces.get("face_count", 0) > 0
        
        # HIGH SEVERITY REQUIREMENTS: All three must be true
        # 1. Strong AI aesthetic similarity (>0.7)
        # 2. Strong deception cues (multiple indicators or high likelihood)
        # 3. Human identity implied (face present)
        strong_ai_similarity = aesthetic_similarity_score > 0.7
        strong_deception = (
            len(deception_indicators) >= 2 or 
            deception_likelihood > 0.6 or
            deception_strength > 0.5
        )
        
        # Determine severity level
        if strong_ai_similarity and strong_deception and has_human_identity:
            # All three criteria met - HIGH severity
            severity = "HIGH"
        elif base_severity >= self.HIGH_SEVERITY_THRESHOLD:
            # High base severity but missing one criterion - MEDIUM
            severity = "MEDIUM"
        elif base_severity >= self.MEDIUM_SEVERITY_THRESHOLD:
            severity = "MEDIUM"
        elif confidence < 0.5 or context_loss_penalty > 0.6:
            # High context loss or low confidence - UNCERTAIN
            severity = "UNCERTAIN"
        else:
            severity = "LOW"
        
        # Generate human-readable reasons (always lead with limitations)
        reasons = self._generate_reasons(
            is_ai=is_ai,
            confidence=confidence,
            aesthetic_similarity_score=aesthetic_similarity_score,
            content_type=content_type,
            deception_indicators=deception_indicators,
            plausible_intents=plausible_intents,
            style=style,
            visual_features=visual_features,
            severity=severity,
            context_loss_penalty=context_loss_penalty
        )
        
        # Prepare risk_factors dict with full context
        risk_factors_dict = {
            "content_type": content_type,
            "style": style,
            "adjusted_severity": round(base_severity, 4),
            "factors": risk_factors,
            "deception_indicator_count": len(deception_indicators),
            "deception_likelihood": round(deception_likelihood, 4),
            "strong_ai_similarity": strong_ai_similarity,
            "strong_deception": strong_deception,
            "has_human_identity": has_human_identity
        }
        
        return DetectionResult(
            is_ai=is_ai,
            confidence=confidence,
            severity=severity,
            reasons=reasons,
            risk_factors=risk_factors_dict,
            classifier_scores=classifier_scores,
            screenshot_confidence=1.0,
            signal_confidence=signal_confidence,
            aesthetic_similarity_score=aesthetic_similarity_score,
            context_loss_penalty=context_loss_penalty,
            plausible_intents=plausible_intents
        )
    
    def _generate_reasons(
        self,
        is_ai: bool,
        confidence: float,
        aesthetic_similarity_score: float,
        content_type: str,
        deception_indicators: List[str],
        plausible_intents: List[Dict[str, Any]],
        style: str,
        visual_features: Dict[str, Any],
        severity: str,
        context_loss_penalty: float
    ) -> List[str]:
        """
        Generate human-readable reasons for the severity assessment.
        
        ALWAYS leads with limitations about decontextualized screenshot analysis.
        """
        reasons = []
        
        # ALWAYS START WITH LIMITATIONS (Step 9 from reframing)
        reasons.append("Based on a single TikTok video frame screenshot (no UI elements)...")
        reasons.append("Without platform context or temporal information...")
        reasons.append("This assessment may change with additional context.")
        
        # Add blank line (will be handled as separate string)
        
        # Analysis findings
        if is_ai:
            # Reference aesthetic similarity, not AI origin proof
            if aesthetic_similarity_score >= 0.7:
                reasons.append(f"Content shows strong similarity to AI-generated aesthetics ({aesthetic_similarity_score:.0%} similarity score).")
            elif aesthetic_similarity_score >= 0.5:
                reasons.append(f"Content shows moderate similarity to AI-generated aesthetics ({aesthetic_similarity_score:.0%} similarity score).")
            else:
                reasons.append(f"Content shows some similarity to AI-generated aesthetics ({aesthetic_similarity_score:.0%} similarity score).")
        
        # Deception indicators from plausible intents
        for intent in plausible_intents[:2]:  # Top 2 intents
            intent_type = intent.get("intent", "")
            likelihood = intent.get("likelihood", 0.0)
            evidence = intent.get("evidence", [])
            
            if likelihood > 0.4:
                if intent_type == "impersonation":
                    reasons.append(f"Impersonation indicators detected (likelihood: {likelihood:.0%}): {', '.join(evidence[:2])}")
                elif intent_type == "promotion":
                    reasons.append(f"Promotion/marketing indicators detected (likelihood: {likelihood:.0%}): {', '.join(evidence[:2])}")
        
        # Specific deception indicators (top 2-3)
        if deception_indicators:
            for indicator in deception_indicators[:3]:
                if "headshot" in indicator.lower():
                    reasons.append("Professional headshot composition detected - often used to create fake profiles.")
                elif "financial" in indicator.lower():
                    reasons.append(f"Financial scam indicators: {indicator}")
                elif "testimonial" in indicator.lower():
                    reasons.append("Testimonial patterns detected - common in product scams.")
        
        # Face detection context
        faces = visual_features.get("faces", {})
        if faces.get("is_portrait") and content_type == "portrait":
            face_count = faces.get("face_count", 0)
            if face_count == 1:
                reasons.append("Single centered face detected - typical of profile pictures used in fake accounts.")
        
        # If UNCERTAIN, explicitly state why
        if severity == "UNCERTAIN":
            if context_loss_penalty > 0.6:
                reasons.append("High context loss due to screenshot degradation - assessment is uncertain.")
            elif confidence < 0.5:
                reasons.append("Low confidence due to conflicting or insufficient signals - assessment is uncertain.")
        
        # Ensure we have at least the limitation statements
        if len(reasons) <= 3:
            reasons.append("Insufficient evidence for definitive classification.")
        
        return reasons
