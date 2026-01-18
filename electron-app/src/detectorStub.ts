import { DetectionResult } from './types';

// Use 127.0.0.1 explicitly to avoid IPv6 resolution issues on Linux
const API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Extract base post ID (just "post_X" part)
 * DOM sensor creates IDs like "post_1_1768711195270" (with timestamp)
 * File watcher extracts "post_1" to use as the API key
 * We need to match that extraction to query the correct result
 * 
 * @param fullPostId - Full post ID from DOM sensor (e.g., "post_1_1768711195270")
 * @returns Base post ID (e.g., "post_1")
 */
function extractBasePostId(fullPostId: string): string {
  // Match "post_" followed by digits
  const match = fullPostId.match(/^(post_\d+)/);
  if (match) {
    return match[1];
  }
  // Fallback: return as-is
  return fullPostId;
}

/**
 * Map API response to a label based on confidence thresholds
 * @param isAI - Whether the image is detected as AI-generated
 * @param confidence - Confidence score between 0 and 1
 * @returns Label string
 * 
 * Thresholds:
 * - Likely Real: is_ai=false AND confidence >= 70%
 * - Unclear: confidence < 60% (either direction)
 * - Possibly AI: is_ai=true AND confidence 60-80%
 * - Likely AI: is_ai=true AND confidence >= 80%
 */
function mapToLabel(isAI: boolean, confidence: number): DetectionResult['label'] {
  // Low confidence = unclear
  if (confidence < 0.6) {
    return 'Unclear';
  }
  
  if (isAI) {
    // AI detected - differentiate by confidence
    if (confidence >= 0.8) {
      return 'Likely AI';      // High confidence AI
    }
    return 'Possibly AI';      // Medium confidence AI
  }
  
  // Not AI detected
  return 'Likely Real';
}

/**
 * Fetch detection result from the classifier API
 * 
 * @param _imageBuffer - JPEG image buffer (unused, fileWatcher sends images separately)
 * @param postId - Unique identifier for the post (full ID from DOM sensor)
 * @returns Detection result with score and label
 */
export async function detectAI(_imageBuffer: Buffer, postId: string): Promise<DetectionResult> {
  // Extract base post ID to match what fileWatcher sends to the API
  const basePostId = extractBasePostId(postId);
  const apiUrl = `${API_BASE_URL}/analyze/${basePostId}`;
  
  console.log(`[Detector] Fetching: ${apiUrl} (full ID: ${postId})`);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    // Handle 404 - analysis not yet complete
    if (response.status === 404) {
      console.log(`[Detector] Post ${basePostId} (from ${postId}): Analysis not ready yet`);
      return {
        postId,
        score: 0,
        label: 'Analyzing...',
        timestamp: Date.now(),
      };
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Map API response to DetectionResult
    // API returns: { is_ai: bool, confidence: float, severity: string, reasons: [], ... }
    const label = mapToLabel(data.is_ai, data.confidence);
    
    console.log(`[Detector] Post ${basePostId}: is_ai=${data.is_ai}, confidence=${(data.confidence * 100).toFixed(1)}%, severity=${data.severity}, label=${label}`);

    return {
      postId,
      score: data.confidence,
      label,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    // Check if it's a connection error
    if (error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED') {
      console.warn(`[Detector] API server not available at ${API_BASE_URL}. Is the classifier server running?`);
    } else {
      console.error(`[Detector] Error fetching result for post ${basePostId}:`, error);
    }
    
    // Return pending state on error
    return {
      postId,
      score: 0,
      label: 'Analyzing...',
      timestamp: Date.now(),
    };
  }
}
