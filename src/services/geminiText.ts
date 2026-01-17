import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

function getAPIKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const API_KEY = getAPIKey();
    if (!API_KEY) {
      throw new Error('Gemini API key not configured');
    }
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

const SCAM_KEYWORDS = [
  'crypto', 'giveaway', 'limited time', 'click here', 'free money',
  'verify account', 'suspended account', 'urgent', 'act now',
  'winner', 'congratulations', 'claim prize', 'click link',
  'verify identity', 'security alert', 'account locked'
];

export interface ThreatAnalysisResult {
  threatType: 'scam' | 'phishing' | 'deepfake' | 'none';
  indicators: string[];
  severity: 'high' | 'medium' | 'low';
}

/**
 * Analyze text for threat patterns
 * @param text - Text to analyze
 * @returns Threat analysis result
 */
export async function analyzeThreats(text: string): Promise<ThreatAnalysisResult> {
  const API_KEY = getAPIKey();
  
  if (!API_KEY) {
    // Fallback to keyword matching
    return analyzeThreatsFallback(text);
  }

  try {
    const model = getGenAI().getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze this text for security threats, scams, phishing attempts, or malicious content.

Text: "${text}"

Check for:
1. Scam keywords: crypto, giveaway, limited time, click here, free money, verify account
2. Phishing indicators: urgency, impersonation, suspicious requests, account suspension threats
3. Deepfake indicators: mentions of AI-generated content, synthetic media
4. Other suspicious patterns

Respond in JSON format:
{
  "threatType": "scam" | "phishing" | "deepfake" | "none",
  "indicators": string[],
  "severity": "high" | "medium" | "low"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Parse JSON response
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '');
    }

    const parsed = JSON.parse(jsonText) as Partial<ThreatAnalysisResult>;

    return {
      threatType: (parsed.threatType || 'none') as ThreatAnalysisResult['threatType'],
      indicators: parsed.indicators || [],
      severity: (parsed.severity || 'low') as ThreatAnalysisResult['severity'],
    };
  } catch (error) {
    console.error('Gemini Text API error:', error);
    // Fallback to keyword matching
    return analyzeThreatsFallback(text);
  }
}

/**
 * Fallback threat analysis using keyword matching
 */
function analyzeThreatsFallback(text: string): ThreatAnalysisResult {
  const lowerText = text.toLowerCase();
  const foundIndicators: string[] = [];
  let threatType: ThreatAnalysisResult['threatType'] = 'none';
  let severity: ThreatAnalysisResult['severity'] = 'low';

  // Check for scam keywords
  for (const keyword of SCAM_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      foundIndicators.push(keyword);
    }
  }

  // Determine threat type and severity
  if (foundIndicators.length > 0) {
    if (lowerText.includes('verify') || lowerText.includes('suspended') || lowerText.includes('locked')) {
      threatType = 'phishing';
      severity = foundIndicators.length > 2 ? 'high' : 'medium';
    } else if (lowerText.includes('crypto') || lowerText.includes('giveaway')) {
      threatType = 'scam';
      severity = foundIndicators.length > 2 ? 'high' : 'medium';
    } else {
      threatType = 'scam';
      severity = foundIndicators.length > 1 ? 'medium' : 'low';
    }
  }

  return {
    threatType,
    indicators: foundIndicators,
    severity,
  };
}

