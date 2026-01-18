"""
Data Models for Detection Results

Structured data classes for API responses and internal processing.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List

@dataclass
class DetectionResult:
    """
    Complete detection result combining ML classifier and intent analysis.
    
    Attributes:
        is_ai: Whether the image was classified as AI-generated (based on aesthetic similarity threshold)
        confidence: ML classifier confidence (0-1), capped by context loss penalty
        severity: Risk severity level (LOW, MEDIUM, HIGH, or UNCERTAIN)
        reasons: Human-readable reasons for the severity assessment
        risk_factors: Detailed risk factor scores and analysis
        classifier_scores: Full score distribution from ML classifier
        screenshot_confidence: Always 1.0 (all inputs are TikTok screenshots)
        signal_confidence: How reliable are extracted features (0-1)
        aesthetic_similarity_score: SDXL aesthetic similarity score (0-1), not origin proof
        context_loss_penalty: Penalty for missing platform/temporal context (0-1)
        plausible_intents: Hypothesis-based intent detection with likelihood + uncertainty
    """
    is_ai: bool
    confidence: float
    severity: str  # LOW, MEDIUM, HIGH, or UNCERTAIN
    reasons: List[str] = field(default_factory=list)
    risk_factors: Dict[str, Any] = field(default_factory=dict)
    classifier_scores: Dict[str, float] = field(default_factory=dict)
    
    # New fields for decontextualized screenshot analysis
    screenshot_confidence: float = 1.0
    signal_confidence: float = 0.7
    aesthetic_similarity_score: float = 0.0
    context_loss_penalty: float = 0.3
    plausible_intents: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert DetectionResult to dictionary for JSON serialization."""
        return {
            "is_ai": self.is_ai,
            "confidence": self.confidence,
            "severity": self.severity,
            "reasons": self.reasons,
            "risk_factors": self.risk_factors,
            "classifier_scores": self.classifier_scores,
            "screenshot_confidence": self.screenshot_confidence,
            "signal_confidence": self.signal_confidence,
            "aesthetic_similarity_score": self.aesthetic_similarity_score,
            "context_loss_penalty": self.context_loss_penalty,
            "plausible_intents": self.plausible_intents
        }
