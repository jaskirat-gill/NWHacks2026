"""
Gemini Educational Explanation Generator

Generates natural language educational explanations using Google's Gemini API
to help users learn to identify AI images themselves.
"""

from google import genai
import logging
from typing import Optional, List, Dict, Any
from models import DetectionResult

logger = logging.getLogger(__name__)


class EducationResponse:
    """Structured response from educational lesson generation."""
    
    def __init__(self, explanation: str, indicators: List[str]):
        self.explanation = explanation
        self.indicators = indicators
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "explanation": self.explanation,
            "indicators": self.indicators
        }


class LessonGenerator:
    """Generates educational explanations using Gemini API."""
    
    # Maximum timeout for Gemini API calls (seconds)
    TIMEOUT_SECONDS = 30
    
    # Maximum retries for API calls
    MAX_RETRIES = 2
    
    def __init__(self, api_key: str):
        """
        Initialize Gemini API client.
        
        Args:
            api_key: Google Generative AI API key
        """
        if not api_key:
            raise ValueError("Gemini API key is required")
        
        self.client = genai.Client(api_key=api_key)
        self.model_name = 'gemini-2.5-flash'
        logger.info("LessonGenerator initialized with Gemini API")
    
    async def generate_education(
        self, 
        detection_result: DetectionResult, 
        image_bytes_list: Optional[List[bytes]] = None
    ) -> EducationResponse:
        """
        Generate educational explanation based on detection results and video frames.
        
        Args:
            detection_result: DetectionResult from the detection pipeline
            image_bytes_list: Optional list of image bytes (video frames) to send to Gemini
        
        Returns:
            EducationResponse with explanation and indicators
        
        Raises:
            Exception: If API call fails after retries
        """
        try:
            prompt = self._build_education_prompt(detection_result)
            
            # Generate lesson with timeout (includes images if provided)
            response = await self._call_gemini_with_retry(prompt, image_bytes_list)
            
            # Parse response - expect JSON with 'explanation' and 'indicators' fields
            education = self._parse_education_response(response, detection_result)
            
            logger.info("Educational content generated successfully")
            return education
            
        except Exception as e:
            logger.warning(f"Gemini education generation failed: {str(e)}")
            # Return fallback template-based explanation
            return self._generate_fallback_education(detection_result)
    
    async def generate_lesson(self, detection_result: DetectionResult, image_bytes: Optional[bytes] = None) -> str:
        """
        Legacy method - Generate educational explanation based on detection results.
        
        Args:
            detection_result: DetectionResult from the detection pipeline
            image_bytes: Optional raw image bytes to send to Gemini for visual analysis
        
        Returns:
            Educational explanation string
        """
        image_list = [image_bytes] if image_bytes else None
        education = await self.generate_education(detection_result, image_list)
        return education.explanation
    
    def _build_education_prompt(self, detection_result: DetectionResult) -> str:
        """
        Build prompt for Gemini educational content generation.
        
        Args:
            detection_result: DetectionResult object
        
        Returns:
            Formatted prompt string
        """
        severity = detection_result.severity
        is_ai = detection_result.is_ai
        confidence = detection_result.confidence
        reasons = detection_result.reasons
        risk_factors = detection_result.risk_factors
        
        content_type = risk_factors.get('content_type', 'unknown')
        style = risk_factors.get('style', 'unknown')
        risk_score = risk_factors.get('risk_score', 0.0)
        
        prompt = f"""You are an educational AI assistant helping users learn to identify AI-generated content on TikTok.

I'm showing you frames from a TikTok video that our system has analyzed. Please review these frames and provide educational content to help users understand why this content may or may not be AI-generated.

**Our System's Analysis Results:**
- Classification: {'AI-generated' if is_ai else 'Human-created'} ({confidence:.0%} confidence)
- Severity Level: {severity}
- Content Type: {content_type}
- Style: {style}
- Risk Score: {risk_score:.0%}

**Key Indicators Our System Found:**
{chr(10).join(f"- {reason}" for reason in reasons) if reasons else "- No specific indicators detected"}

**Your Task:**
Based on the video frames provided and our analysis, generate educational content that:
1. Explains what visual clues in these specific frames suggest AI generation (or why they appear authentic)
2. Points out specific details users should look for (hands, faces, backgrounds, text, motion blur, etc.)
3. Teaches general skills for spotting AI-generated TikTok content
4. Maintains a helpful, educational tone - not alarmist

Return your response as JSON with the following structure:
{{
  "explanation": "A 2-3 paragraph educational explanation about this specific content...",
  "indicators": ["Specific visual indicator 1", "Specific visual indicator 2", "...up to 5 key indicators"]
}}

Focus on being specific about what you see in these particular frames."""
        
        return prompt
    
    def _build_prompt(self, detection_result: DetectionResult) -> str:
        """Legacy method - calls _build_education_prompt."""
        return self._build_education_prompt(detection_result)
    
    async def _call_gemini_with_retry(self, prompt: str, image_bytes_list: Optional[List[bytes]] = None) -> str:
        """
        Call Gemini API with retry logic and timeout handling.
        
        Args:
            prompt: Prompt string for Gemini
            image_bytes_list: Optional list of image bytes to include in the request
        
        Returns:
            Response text from Gemini
        
        Raises:
            Exception: If all retries fail
        """
        import asyncio
        
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                # Run synchronous Gemini call in executor to support timeout
                loop = asyncio.get_event_loop()
                response = await asyncio.wait_for(
                    loop.run_in_executor(None, self._call_gemini_sync, prompt, image_bytes_list),
                    timeout=self.TIMEOUT_SECONDS
                )
                return response
                
            except asyncio.TimeoutError:
                logger.warning(f"Gemini API timeout (attempt {attempt + 1}/{self.MAX_RETRIES + 1})")
                if attempt == self.MAX_RETRIES:
                    raise Exception("Gemini API call timed out after retries")
            
            except Exception as e:
                logger.warning(f"Gemini API error (attempt {attempt + 1}/{self.MAX_RETRIES + 1}): {str(e)}")
                if attempt == self.MAX_RETRIES:
                    raise Exception(f"Gemini API call failed after retries: {str(e)}")
        
        raise Exception("Failed to generate lesson")
    
    def _call_gemini_sync(self, prompt: str, image_bytes_list: Optional[List[bytes]] = None) -> str:
        """
        Synchronous Gemini API call (runs in executor).
        
        Args:
            prompt: Prompt string
            image_bytes_list: Optional list of image bytes to include in the request
        
        Returns:
            Response text
        """
        import base64
        from PIL import Image
        import io
        
        # Build contents array - start with prompt, then add all images
        contents = [prompt]
        
        # Add images if provided
        if image_bytes_list:
            for i, image_bytes in enumerate(image_bytes_list):
                try:
                    # Determine MIME type from image bytes
                    img = Image.open(io.BytesIO(image_bytes))
                    mime_type = f"image/{img.format.lower()}" if img.format else "image/jpeg"
                    
                    # Encode image to base64
                    image_b64 = base64.b64encode(image_bytes).decode()
                    
                    # Add image to contents
                    contents.append({
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_b64
                        }
                    })
                    logger.debug(f"Including image {i+1}/{len(image_bytes_list)} in Gemini request (MIME: {mime_type})")
                except Exception as e:
                    logger.warning(f"Failed to process image {i+1} for Gemini: {str(e)}, skipping")
                    continue
        
        # Call Gemini API with multimodal content
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=contents
        )
        return response.text
    
    def _parse_education_response(self, response_text: str, detection_result: DetectionResult) -> EducationResponse:
        """
        Parse Gemini response to extract education content.
        
        Args:
            response_text: Raw response from Gemini
            detection_result: Original detection result for fallback indicators
        
        Returns:
            EducationResponse with explanation and indicators
        """
        import json
        import re
        
        # Try to extract JSON from response
        # Gemini sometimes wraps JSON in markdown code blocks
        json_match = re.search(r'\{[^{}]*(?:\[[^\]]*\][^{}]*)*\}', response_text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(0))
                explanation = data.get('explanation', '').strip()
                indicators = data.get('indicators', [])
                
                if explanation:
                    # Ensure indicators is a list of strings
                    if isinstance(indicators, list):
                        indicators = [str(ind) for ind in indicators[:5]]  # Max 5 indicators
                    else:
                        indicators = []
                    
                    return EducationResponse(explanation=explanation, indicators=indicators)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from Gemini response")
        
        # If JSON parsing fails, use the response as explanation
        explanation = response_text.strip()
        # Use detection result reasons as fallback indicators
        indicators = [str(r) for r in detection_result.reasons[:5]] if detection_result.reasons else []
        
        return EducationResponse(explanation=explanation, indicators=indicators)
    
    def _parse_response(self, response_text: str) -> str:
        """
        Legacy method - Parse Gemini response to extract lesson text.
        
        Args:
            response_text: Raw response from Gemini
        
        Returns:
            Extracted lesson text
        """
        import json
        import re
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[^}]+\}', response_text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(0))
                if 'lesson' in data:
                    return data['lesson'].strip()
                if 'explanation' in data:
                    return data['explanation'].strip()
            except json.JSONDecodeError:
                pass
        
        # If JSON parsing fails, return the response as-is
        return response_text.strip()
    
    def _generate_fallback_education(self, detection_result: DetectionResult) -> EducationResponse:
        """
        Generate template-based fallback education when Gemini API fails.
        
        Args:
            detection_result: DetectionResult object
        
        Returns:
            EducationResponse with fallback explanation and indicators
        """
        severity = detection_result.severity
        is_ai = detection_result.is_ai
        confidence = detection_result.confidence
        reasons = detection_result.reasons
        
        # Build explanation
        explanation_parts = []
        
        if is_ai:
            explanation_parts.append(
                f"Our analysis indicates this TikTok content is likely AI-generated "
                f"with {confidence:.0%} confidence. The severity level is {severity}."
            )
        else:
            explanation_parts.append(
                "Our analysis suggests this TikTok content appears to be authentic. "
                f"The severity level is {severity}."
            )
        
        # Add educational content based on severity
        if severity == "HIGH":
            explanation_parts.append(
                "\n\nThis content shows multiple indicators commonly associated with AI generation. "
                "When viewing similar content, look for unnatural skin textures, inconsistent lighting, "
                "or backgrounds that seem too perfect. AI-generated faces often have subtle issues "
                "around hair, ears, or jewelry. Be especially cautious of content making financial claims."
            )
        elif severity == "MEDIUM":
            explanation_parts.append(
                "\n\nThis content shows some characteristics that may indicate AI generation. "
                "Pay attention to details like hand positioning, text clarity, and whether the "
                "person's movements seem natural. AI often struggles with fine details and consistent motion."
            )
        else:
            explanation_parts.append(
                "\n\nWhile this content shows minimal AI indicators, staying vigilant is always good. "
                "Look for natural imperfections, varied lighting, and realistic body language. "
                "Authentic content typically has minor flaws that AI tends to miss."
            )
        
        explanation = "".join(explanation_parts)
        
        # Build indicators from reasons
        indicators = []
        if reasons:
            indicators = [str(r) for r in reasons[:5]]
        else:
            # Default indicators based on severity
            if is_ai:
                indicators = [
                    "Visual patterns consistent with AI generation",
                    "Analysis confidence score above threshold",
                    f"Severity level: {severity}"
                ]
            else:
                indicators = [
                    "Natural visual characteristics detected",
                    "No major AI generation indicators found"
                ]
        
        return EducationResponse(explanation=explanation, indicators=indicators)
    
    def _generate_fallback_lesson(self, detection_result: DetectionResult) -> str:
        """
        Legacy method - Generate template-based fallback lesson when Gemini API fails.
        
        Args:
            detection_result: DetectionResult object
        
        Returns:
            Fallback lesson text
        """
        education = self._generate_fallback_education(detection_result)
        return education.explanation
