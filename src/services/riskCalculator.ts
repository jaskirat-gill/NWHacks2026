import { ThreatAnalysisResult } from './geminiText';
import { URLSafetyResult } from './safeBrowsing';

export interface RiskCalculationParams {
  aiConfidence: number;
  threatIndicators: string[];
  threatType: ThreatAnalysisResult['threatType'];
  urlSafety: URLSafetyResult;
  detectedURLs: string[];
}

export interface RiskResult {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reasons: string[];
}

/**
 * Calculate risk score based on AI detection, threat indicators, and URL safety
 */
export function calculateRisk(params: RiskCalculationParams): RiskResult {
  const { aiConfidence, threatIndicators, threatType, urlSafety, detectedURLs } = params;
  const reasons: string[] = [];
  let score = 0;

  // Base score from AI confidence
  score += aiConfidence * 30;

  // Threat type scoring
  if (threatType === 'phishing') {
    score += 40;
    reasons.push('Phishing indicators detected');
  } else if (threatType === 'scam') {
    score += 30;
    reasons.push('Scam indicators detected');
  } else if (threatType === 'deepfake') {
    score += 25;
    reasons.push('Deepfake/synthetic media detected');
  }

  // Threat indicators count
  const indicatorCount = threatIndicators.length;
  if (indicatorCount > 2) {
    score += 30;
    reasons.push(`Multiple threat indicators (${indicatorCount})`);
  } else if (indicatorCount > 0) {
    score += 15;
    reasons.push(`Threat indicators found (${indicatorCount})`);
  }

  // URL safety
  if (!urlSafety.isSafe) {
    score += 50;
    reasons.push(`Unsafe URL detected: ${urlSafety.threatTypes.join(', ')}`);
  } else if (detectedURLs && detectedURLs.length > 0) {
    score += 5;
    reasons.push('URLs detected (verified safe)');
  }

  // Determine risk level
  let level: RiskResult['level'] = 'LOW';
  if (score >= 70) {
    level = 'HIGH';
  } else if (score >= 40) {
    level = 'MEDIUM';
  }

  // If AI detected but no threats, mark as LOW (AI art)
  if (aiConfidence > 0.5 && threatType === 'none' && indicatorCount === 0 && urlSafety.isSafe) {
    level = 'LOW';
    reasons.push('AI-generated content detected (no threats)');
  }

  return {
    level,
    score: Math.min(100, Math.round(score)),
    reasons: reasons.length > 0 ? reasons : ['AI content detected'],
  };
}

