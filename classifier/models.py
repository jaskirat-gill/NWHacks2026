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
        is_ai: Whether the image was classified as AI-generated
        confidence: ML classifier confidence (0-1)
        severity: Risk severity level (LOW, MEDIUM, HIGH)
        reasons: Human-readable reasons for the severity assessment
        risk_factors: Detailed risk factor scores and analysis
        classifier_scores: Full score distribution from ML classifier
    """
    is_ai: bool
    confidence: float
    severity: str  # LOW, MEDIUM, or HIGH
    reasons: List[str] = field(default_factory=list)
    risk_factors: Dict[str, Any] = field(default_factory=dict)
    classifier_scores: Dict[str, float] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert DetectionResult to dictionary for JSON serialization."""
        return {
            "is_ai": self.is_ai,
            "confidence": self.confidence,
            "severity": self.severity,
            "reasons": self.reasons,
            "risk_factors": self.risk_factors,
            "classifier_scores": self.classifier_scores
        }
