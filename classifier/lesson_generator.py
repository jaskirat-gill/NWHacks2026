"""
Gemini Educational Explanation Generator

Generates natural language educational explanations using Google's Gemini API
to help users learn to identify AI images themselves.
"""

from google import genai
import logging
from typing import Optional
from models import DetectionResult

logger = logging.getLogger(__name__)

class LessonGenerator:
    """Generates educational explanations using Gemini API."""
    
    # Maximum timeout for Gemini API calls (seconds)
    TIMEOUT_SECONDS = 10
    
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
    
    async def generate_lesson(self, detection_result: DetectionResult) -> str:
        """
        Generate educational explanation based on detection results.
        
        Args:
            detection_result: DetectionResult from the detection pipeline
        
        Returns:
            Educational explanation string
        
        Raises:
            Exception: If API call fails after retries
        """
        try:
            prompt = self._build_prompt(detection_result)
            
            # Generate lesson with timeout
            response = await self._call_gemini_with_retry(prompt)
            
            # Parse response - expect JSON with 'lesson' field
            lesson = self._parse_response(response)
            
            logger.info("Educational lesson generated successfully")
            return lesson
            
        except Exception as e:
            logger.warning(f"Gemini lesson generation failed: {str(e)}")
            # Return fallback template-based explanation
            return self._generate_fallback_lesson(detection_result)
    
    def _build_prompt(self, detection_result: DetectionResult) -> str:
        """
        Build prompt for Gemini based on detection results.
        
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
        
        prompt = f"""You are an educational AI assistant helping users learn to identify AI-generated images and avoid scams.

Based on analysis of an image, provide a friendly, educational explanation that teaches the user what to look for.

**Analysis Results:**
- Classification: {'AI-generated' if is_ai else 'Human-created'} ({confidence:.0%} confidence)
- Severity Level: {severity}
- Content Type: {content_type}
- Style: {style}
- Risk Score: {risk_score:.0%}

**Key Indicators Found:**
{chr(10).join(f"- {reason}" for reason in reasons)}

**Your Task:**
Generate a friendly, educational explanation (2-3 paragraphs) that:
1. Clearly explains what was detected and why it's concerning (if applicable)
2. Teaches the user specific visual indicators they should look for
3. Provides actionable advice on how to spot similar AI images or scams in the future
4. Maintains a helpful, non-alarmist tone

Return your response as JSON with a single "lesson" field containing the educational explanation text.

Example format:
{{
  "lesson": "Your educational explanation here..."
}}"""
        
        return prompt
    
    async def _call_gemini_with_retry(self, prompt: str) -> str:
        """
        Call Gemini API with retry logic and timeout handling.
        
        Args:
            prompt: Prompt string for Gemini
        
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
                    loop.run_in_executor(None, self._call_gemini_sync, prompt),
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
    
    def _call_gemini_sync(self, prompt: str) -> str:
        """
        Synchronous Gemini API call (runs in executor).
        
        Args:
            prompt: Prompt string
        
        Returns:
            Response text
        """
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt
        )
        return response.text
    
    def _parse_response(self, response_text: str) -> str:
        """
        Parse Gemini response to extract lesson text.
        
        Args:
            response_text: Raw response from Gemini
        
        Returns:
            Extracted lesson text
        """
        import json
        import re
        
        # Try to extract JSON from response
        # Gemini sometimes wraps JSON in markdown code blocks
        json_match = re.search(r'\{[^}]+\}', response_text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(0))
                if 'lesson' in data:
                    return data['lesson'].strip()
            except json.JSONDecodeError:
                pass
        
        # If JSON parsing fails, return the response as-is (may be plain text)
        return response_text.strip()
    
    def _generate_fallback_lesson(self, detection_result: DetectionResult) -> str:
        """
        Generate template-based fallback lesson when Gemini API fails.
        
        Args:
            detection_result: DetectionResult object
        
        Returns:
            Fallback lesson text
        """
        severity = detection_result.severity
        is_ai = detection_result.is_ai
        confidence = detection_result.confidence
        reasons = detection_result.reasons
        
        lesson_parts = []
        
        # Introduction
        if is_ai:
            lesson_parts.append(
                f"This image has been analyzed and classified as AI-generated with "
                f"{confidence:.0%} confidence. The severity level is {severity}."
            )
        else:
            lesson_parts.append(
                "This image has been analyzed and appears to be human-created. "
                f"However, the severity level is {severity} based on detected risk indicators."
            )
        
        # Key findings
        if reasons:
            lesson_parts.append("\n**What was detected:**")
            for reason in reasons[:3]:  # Top 3 reasons
                lesson_parts.append(f"- {reason}")
        
        # Educational advice
        lesson_parts.append("\n**How to spot similar issues:**")
        
        if severity == "HIGH":
            lesson_parts.append(
                "This image shows multiple concerning indicators. When evaluating images, "
                "look for professional headshot compositions, suspicious financial language, "
                "or testimonial patterns. Always verify the source of images and be cautious "
                "with images that seem too perfect or make unrealistic claims."
            )
        elif severity == "MEDIUM":
            lesson_parts.append(
                "This image shows some concerning characteristics. Pay attention to composition, "
                "text content, and whether the image matches its claimed context. "
                "Question images that seem out of place or make unusual claims."
            )
        else:
            lesson_parts.append(
                "While this image shows minimal risk indicators, it's always good practice to "
                "verify the source of images, especially when they're used in important contexts "
                "like financial transactions or personal communications."
            )
        
        return "\n".join(lesson_parts)
