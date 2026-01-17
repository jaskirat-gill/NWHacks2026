import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
}

export interface VisionAnalysisResult {
  isAI: boolean;
  confidence: number;
  detectedText: string;
  detectedURLs: string[];
  suspiciousElements: string[];
}

/**
 * Analyze screenshot for AI-generated content
 * @param base64Image - Base64 encoded image
 * @returns Analysis result with AI detection, text, and URLs
 */
export async function analyzeScreenshot(base64Image: string): Promise<VisionAnalysisResult> {
  if (!genAI || !API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze this screenshot and determine:
1. Does this image contain AI-generated content, deepfakes, or synthetic media? (yes/no with confidence 0-1)
2. Extract all visible text from the image
3. Identify any URLs or links visible in the image
4. Note any suspicious visual elements

Respond in JSON format:
{
  "isAI": boolean,
  "confidence": number (0-1),
  "detectedText": string,
  "detectedURLs": string[],
  "suspiciousElements": string[]
}`;

    // Convert base64 to format expected by Gemini
    const imagePart = {
      inlineData: {
        data: base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, ''),
        mimeType: 'image/png',
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response (handle markdown code blocks if present)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '');
    }

    const parsed = JSON.parse(jsonText) as Partial<VisionAnalysisResult>;

    return {
      isAI: parsed.isAI || false,
      confidence: parsed.confidence || 0,
      detectedText: parsed.detectedText || '',
      detectedURLs: parsed.detectedURLs || [],
      suspiciousElements: parsed.suspiciousElements || [],
    };
  } catch (error) {
    console.error('Gemini Vision API error:', error);
    // Retry once on rate limit
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('rate limit'))) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return analyzeScreenshot(base64Image);
    }
    throw error;
  }
}

