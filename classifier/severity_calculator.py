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
        intent_analysis: Dict[str, Any]
    ) -> DetectionResult:
        """
        Calculate severity and generate reasons from all analysis components.
        
        Args:
            classifier_result: Output from Classifier.predict()
            visual_features: Output from VisualAnalyzer.analyze()
            intent_analysis: Output from IntentDetector.detect_intent()
        
        Returns:
            DetectionResult with severity, reasons, and all analysis data
        """
        is_ai = classifier_result.get("label", "").lower() in ["ai", "artificial"]
        confidence = classifier_result.get("confidence", 0.0)
        classifier_scores = classifier_result.get("scores", {})
        
        risk_score = intent_analysis.get("risk_score", 0.0)
        content_type = intent_analysis.get("content_type", "other")
        deception_indicators = intent_analysis.get("deception_indicators", [])
        risk_factors = intent_analysis.get("risk_factors", {})
        style = intent_analysis.get("style", "mixed")
        
        # Calculate adjusted severity score
        # Combine ML confidence and intent risk score
        # If AI detected, severity increases with confidence
        # If human detected, severity is based on intent risk
        if is_ai:
            # AI-generated images: severity based on confidence + risk
            # High confidence AI with high risk = very concerning
            base_severity = (confidence * 0.6) + (risk_score * 0.4)
        else:
            # Human images: severity based on risk indicators
            # Even if human, high risk indicators are concerning
            base_severity = risk_score
        
        # Adjust for content type
        content_multiplier = self.CONTENT_TYPE_MULTIPLIERS.get(content_type, 1.0)
        adjusted_severity = base_severity * content_multiplier
        
        # Cap at 1.0
        adjusted_severity = min(1.0, adjusted_severity)
        
        # Determine severity level
        if adjusted_severity >= self.HIGH_SEVERITY_THRESHOLD:
            severity = "HIGH"
        elif adjusted_severity >= self.MEDIUM_SEVERITY_THRESHOLD:
            severity = "MEDIUM"
        else:
            severity = "LOW"
        
        # Generate human-readable reasons
        reasons = self._generate_reasons(
            is_ai=is_ai,
            confidence=confidence,
            risk_score=risk_score,
            content_type=content_type,
            deception_indicators=deception_indicators,
            style=style,
            visual_features=visual_features
        )
        
        # Prepare risk_factors dict with full context
        risk_factors_dict = {
            "risk_score": round(risk_score, 4),
            "content_type": content_type,
            "style": style,
            "adjusted_severity": round(adjusted_severity, 4),
            "factors": risk_factors,
            "deception_indicator_count": len(deception_indicators)
        }
        
        return DetectionResult(
            is_ai=is_ai,
            confidence=confidence,
            severity=severity,
            reasons=reasons,
            risk_factors=risk_factors_dict,
            classifier_scores=classifier_scores
        )
    
    def _generate_reasons(
        self,
        is_ai: bool,
        confidence: float,
        risk_score: float,
        content_type: str,
        deception_indicators: List[str],
        style: str,
        visual_features: Dict[str, Any]
    ) -> List[str]:
        """
        Generate human-readable reasons for the severity assessment.
        
        Prioritizes most important and visible indicators.
        """
        reasons = []
        
        # 1. ML Classification reason (always include if confident)
        if is_ai:
            if confidence >= 0.9:
                reasons.append(f"This image is very likely AI-generated ({confidence:.0%} confidence).")
            elif confidence >= 0.7:
                reasons.append(f"This image appears to be AI-generated ({confidence:.0%} confidence).")
            else:
                reasons.append(f"This image may be AI-generated ({confidence:.0%} confidence).")
        
        # 2. Content type reasons
        if content_type == "portrait" and risk_score > 0.3:
            reasons.append("Professional portrait detected, which is commonly used in catfishing scams.")
        elif content_type == "document" and risk_score > 0.3:
            reasons.append("Document-style image detected, which may be used in phishing attempts.")
        
        # 3. Deception indicators (prioritize most important)
        if deception_indicators:
            # Show top 3 most concerning indicators
            for indicator in deception_indicators[:3]:
                # Convert technical indicators to user-friendly messages
                if "headshot" in indicator.lower():
                    reasons.append("Professional headshot composition detected - often used to create fake profiles.")
                elif "financial" in indicator.lower() or "keyword" in indicator.lower():
                    reasons.append(f"Financial scam indicators detected: {indicator}")
                elif "testimonial" in indicator.lower():
                    reasons.append("Testimonial patterns detected - common in product scams.")
                elif "email" in indicator.lower() or "phone" in indicator.lower():
                    reasons.append("Personal information patterns detected - possible phishing attempt.")
                elif "scam phrase" in indicator.lower():
                    reasons.append("Suspicious marketing phrases detected.")
                else:
                    reasons.append(indicator)
        
        # 4. Risk score context
        if risk_score >= 0.6 and len(reasons) < 3:
            reasons.append("Multiple risk indicators suggest this image may be used for deceptive purposes.")
        elif risk_score >= 0.4 and is_ai and len(reasons) < 2:
            reasons.append("This AI-generated image shows characteristics commonly associated with scams.")
        
        # 5. Style context (if artistic, mention it's less risky)
        if style == "artistic" and risk_score < 0.3:
            reasons.append("Image appears to be artistic in nature, which is generally less concerning.")
        
        # 6. Face detection context (if portrait)
        faces = visual_features.get("faces", {})
        if faces.get("is_portrait") and content_type == "portrait":
            face_count = faces.get("face_count", 0)
            if face_count == 1:
                reasons.append("Single centered face detected - typical of profile pictures used in fake accounts.")
        
        # Ensure we have at least one reason
        if not reasons:
            if is_ai:
                reasons.append(f"Image classified as AI-generated with {confidence:.0%} confidence.")
            else:
                reasons.append("No significant risk indicators detected.")
        
        return reasons
