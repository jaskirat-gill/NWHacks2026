"""
Context Loss Calculator

Calculates penalty for missing context in decontextualized TikTok screenshots.
All inputs are single frames without platform UI elements, so context loss is always present.
"""

from typing import Dict, Any

class ContextLossCalculator:
    """Calculates context loss penalty based on missing platform/temporal context."""
    
    def calculate(
        self,
        signal_confidence: float,
        ocr_confidence: float = 0.5
    ) -> Dict[str, Any]:
        """
        Calculate context loss penalty for decontextualized screenshots.
        
        All TikTok screenshots have base context loss from:
        - Missing platform cues (no UI elements)
        - Single frame only (no temporal context)
        
        Additional penalty based on signal quality degradation.
        
        Args:
            signal_confidence: float (0-1) - how reliable are extracted features
            ocr_confidence: float (0-1) - OCR extraction confidence
        
        Returns:
            Dictionary with:
                - context_loss_penalty: float (0-1) - penalty to apply
                - max_achievable_confidence: float (0-1) - max confidence after penalty
                - factors: Dict explaining penalty sources
        """
        # Base penalty: always missing platform + temporal context
        base_penalty = 0.3
        
        # Additional penalty based on signal degradation
        # Lower signal_confidence = more context lost due to degradation
        signal_penalty = (1.0 - signal_confidence) * 0.4
        
        # Additional penalty if OCR is incomplete/unreliable
        # Low OCR confidence means we're missing textual context
        ocr_penalty = (1.0 - ocr_confidence) * 0.2
        
        # Total context loss penalty
        total_penalty = base_penalty + signal_penalty + ocr_penalty
        
        # Cap penalty: even worst case, we still have visual + aesthetic signals
        # Max penalty = 0.7 (leaves 30% confidence floor)
        # Min penalty = 0.3 (always missing platform/temporal context)
        total_penalty = max(0.3, min(0.7, total_penalty))
        
        # Calculate max achievable confidence after penalty
        max_achievable_confidence = 1.0 - (total_penalty * 0.3)
        # This means: if penalty is 0.7, max confidence is 0.79 (1.0 - 0.21)
        # If penalty is 0.3, max confidence is 0.91 (1.0 - 0.09)
        
        factors = {
            "base_penalty": round(base_penalty, 4),
            "signal_penalty": round(signal_penalty, 4),
            "ocr_penalty": round(ocr_penalty, 4),
            "missing_platform_context": True,
            "single_frame_only": True,
            "no_ui_elements": True
        }
        
        return {
            "context_loss_penalty": round(total_penalty, 4),
            "max_achievable_confidence": round(max_achievable_confidence, 4),
            "factors": factors
        }

