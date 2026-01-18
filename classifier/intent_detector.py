"""
Intent Detection & Risk Scoring Module

Analyzes visual features to determine deceptive intent and calculate risk scores.
"""

from typing import Dict, Any, List, Tuple
import re

class IntentDetector:
    """Detects intent and calculates risk scores based on visual features."""
    
    # Financial keywords that indicate potential scams
    FINANCIAL_KEYWORDS = [
        'money', 'cash', 'bitcoin', 'crypto', 'investment', 'profit', 'earn',
        'guaranteed', 'free money', 'get rich', 'make money', 'work from home',
        'payment', 'deposit', 'refund', 'account', 'verify', 'suspended',
        'click here', 'limited time', 'act now', 'urgent', 'congratulations'
    ]
    
    # Testimonial indicators
    TESTIMONIAL_INDICATORS = [
        'testimonial', 'review', 'verified buyer', 'customer says',
        'before and after', 'results', 'success story'
    ]
    
    def __init__(self):
        """Initialize intent detector with default weights."""
        # Risk weights for different factor types
        self.weights = {
            'portrait_composition': 0.3,  # Professional headshots are risky
            'financial_content': 0.4,     # Financial imagery is very risky
            'testimonial_text': 0.2,      # Testimonial patterns are moderately risky
            'product_promotion': 0.1       # Product promotion is less risky
        }
    
    def detect_intent(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze visual features to detect intent and calculate risk scores.
        
        Args:
            features: Dictionary from VisualAnalyzer containing:
                - faces: face detection results
                - text: OCR results
                - metadata: image metadata
        
        Returns:
            Dictionary with:
                - content_type: str (portrait, product, document, artistic, scenic, other)
                - deception_indicators: List[str]
                - style: str ("realistic" | "artistic" | "mixed")
                - risk_score: float (0-1)
                - risk_factors: Dict with individual factor scores
        """
        faces = features.get('faces', {})
        text = features.get('text', {})
        metadata = features.get('metadata', {})
        
        # 1. Classify content type
        content_type, content_confidence = self._classify_content_type(faces, text, metadata)
        
        # 2. Detect deception indicators
        deception_indicators = self._detect_deception_indicators(faces, text, metadata)
        
        # 3. Classify artistic vs realistic
        style, realism_score = self._classify_style(faces, metadata)
        
        # 4. Calculate risk factors
        risk_factors = self._calculate_risk_factors(
            faces, text, metadata, content_type, deception_indicators
        )
        
        # 5. Calculate total risk score
        risk_score = self._calculate_total_risk(risk_factors, style)
        
        return {
            "content_type": content_type,
            "content_confidence": content_confidence,
            "deception_indicators": deception_indicators,
            "style": style,
            "realism_score": realism_score,
            "risk_score": round(risk_score, 4),
            "risk_factors": risk_factors
        }
    
    def _classify_content_type(
        self,
        faces: Dict[str, Any],
        text: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> Tuple[str, float]:
        """
        Classify image content type based on visual features.
        
        Returns:
            (content_type, confidence) tuple
        """
        face_count = faces.get('face_count', 0)
        is_portrait = faces.get('is_portrait', False)
        text_found = text.get('text_found', '').strip()
        word_count = text.get('word_count', 0)
        text_locations = text.get('text_locations', [])
        
        # Document: lots of text, minimal faces
        if word_count > 50 and len(text_locations) > 5:
            return ("document", 0.8)
        
        # Portrait: single centered face, minimal text
        if face_count == 1 and is_portrait and word_count < 10:
            return ("portrait", 0.9)
        
        # Product: multiple objects, text overlay, no faces or minimal faces
        if (face_count == 0 or face_count <= 2) and word_count > 5 and word_count < 30:
            # Check if text is overlaid (text locations spread across image)
            if len(text_locations) > 2:
                return ("product", 0.7)
        
        # Artistic: low face quality, unusual composition, or clearly artistic metadata
        face_quality = faces.get('face_quality', 0.0)
        if face_quality < 0.1 and face_count > 0:
            return ("artistic", 0.6)
        
        # Scenic: no faces, minimal text, landscape orientation
        width = metadata.get('width', 1)
        height = metadata.get('height', 1)
        aspect_ratio = width / height if height > 0 else 1.0
        
        if (face_count == 0 and 
            word_count < 5 and 
            (aspect_ratio > 1.3 or aspect_ratio < 0.75)):  # Wide or tall
            return ("scenic", 0.7)
        
        # Default to other
        return ("other", 0.5)
    
    def _detect_deception_indicators(
        self,
        faces: Dict[str, Any],
        text: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> List[str]:
        """
        Detect specific deception indicators in the image.
        
        Returns:
            List of deception indicator strings
        """
        indicators = []
        
        # 1. Professional headshot composition
        if faces.get('is_portrait', False) and faces.get('face_count', 0) == 1:
            face_locations = faces.get('face_locations', [])
            if face_locations:
                face = face_locations[0]
                # Check if face takes up significant portion (typical of professional headshots)
                if face.get('width', 0) > 0.4 and face.get('height', 0) > 0.4:
                    indicators.append("Professional headshot composition")
        
        # 2. Financial content detection
        text_found = text.get('text_found', '').lower()
        for keyword in self.FINANCIAL_KEYWORDS:
            if keyword in text_found:
                indicators.append(f"Financial keyword detected: '{keyword}'")
                break  # Only add once per category
        
        # 3. Testimonial-style text
        for indicator in self.TESTIMONIAL_INDICATORS:
            if indicator in text_found:
                indicators.append(f"Testimonial pattern detected: '{indicator}'")
                break
        
        # 4. Too-good-to-be-true product claims
        # Look for common scam phrases
        scam_phrases = [
            r'100%\s*guaranteed',
            r'free\s+[\$\d]+',
            r'make\s+\$\d+',
            r'limited\s+time',
            r'act\s+now'
        ]
        for phrase in scam_phrases:
            if re.search(phrase, text_found, re.IGNORECASE):
                indicators.append("Scam phrase detected in text")
                break
        
        # 5. Document-like images with personal information patterns
        # Check for patterns like email, phone, SSN patterns
        if re.search(r'\b[\w\.-]+@[\w\.-]+\.\w+\b', text_found):
            indicators.append("Email address detected (potential phishing)")
        
        if re.search(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', text_found):
            indicators.append("Phone number pattern detected")
        
        return indicators
    
    def _classify_style(
        self,
        faces: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> Tuple[str, float]:
        """
        Classify image style as realistic, artistic, or mixed.
        
        Returns:
            (style, realism_score) tuple where realism_score is 0-1
        """
        face_quality = faces.get('face_quality', 0.0)
        quality_score = metadata.get('quality_score', 0.0)
        has_compression_artifacts = metadata.get('has_compression_artifacts', False)
        
        # Realistic images tend to have:
        # - Higher face quality (if faces present)
        # - Higher overall quality
        # - Less compression artifacts
        
        realism_score = 0.5  # Base score
        
        # Adjust based on face quality (if faces present)
        if faces.get('face_count', 0) > 0:
            realism_score = face_quality * 0.6 + quality_score * 0.4
        else:
            # No faces, base on overall quality
            realism_score = quality_score
        
        # Penalize compression artifacts
        if has_compression_artifacts:
            realism_score *= 0.8
        
        # Clamp to 0-1
        realism_score = max(0.0, min(1.0, realism_score))
        
        # Classify style
        if realism_score > 0.7:
            style = "realistic"
        elif realism_score < 0.4:
            style = "artistic"
        else:
            style = "mixed"
        
        return (style, round(realism_score, 4))
    
    def _calculate_risk_factors(
        self,
        faces: Dict[str, Any],
        text: Dict[str, Any],
        metadata: Dict[str, Any],
        content_type: str,
        deception_indicators: List[str]
    ) -> Dict[str, float]:
        """
        Calculate individual risk factor scores.
        
        Returns:
            Dictionary of risk factor names to scores (0-1)
        """
        factors = {}
        
        # 1. Portrait composition risk
        if faces.get('is_portrait', False) and content_type == 'portrait':
            # Professional headshots are high risk for catfishing
            face_quality = faces.get('face_quality', 0.0)
            # Higher quality portraits are more concerning (more realistic)
            factors['portrait_composition'] = min(face_quality * 1.5, 1.0)
        else:
            factors['portrait_composition'] = 0.0
        
        # 2. Financial content risk
        financial_score = 0.0
        text_found = text.get('text_found', '').lower()
        
        # Count financial keywords
        financial_keyword_count = sum(1 for kw in self.FINANCIAL_KEYWORDS if kw in text_found)
        if financial_keyword_count > 0:
            # More keywords = higher risk
            financial_score = min(financial_keyword_count * 0.3, 1.0)
        
        factors['financial_content'] = financial_score
        
        # 3. Testimonial risk
        testimonial_score = 0.0
        for indicator in self.TESTIMONIAL_INDICATORS:
            if indicator in text_found:
                testimonial_score = 0.6  # Moderate risk
                break
        
        factors['testimonial_text'] = testimonial_score
        
        # 4. Product promotion risk
        if content_type == 'product':
            # Products with too much text or suspicious phrases are riskier
            word_count = text.get('word_count', 0)
            if word_count > 20:  # Lots of text suggests aggressive marketing
                factors['product_promotion'] = 0.4
            else:
                factors['product_promotion'] = 0.1
        else:
            factors['product_promotion'] = 0.0
        
        return factors
    
    def _calculate_total_risk(
        self,
        risk_factors: Dict[str, float],
        style: str
    ) -> float:
        """
        Calculate total risk score from individual factors.
        
        Args:
            risk_factors: Dictionary of factor names to scores
            style: Image style ("realistic" | "artistic" | "mixed")
        
        Returns:
            Total risk score (0-1)
        """
        # Weighted sum of risk factors
        weighted_sum = sum(
            risk_factors.get(factor, 0.0) * self.weights.get(factor, 0.0)
            for factor in self.weights.keys()
        )
        
        # Adjust based on style
        # Realistic images are more concerning than artistic ones
        style_multiplier = {
            "realistic": 1.0,
            "mixed": 0.8,
            "artistic": 0.5
        }.get(style, 0.8)
        
        total_risk = weighted_sum * style_multiplier
        
        # Ensure score is between 0 and 1
        return max(0.0, min(1.0, total_risk))
