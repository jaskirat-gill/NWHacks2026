import { DetectionResult } from './types';

// Use 127.0.0.1 explicitly to avoid IPv6 resolution issues on Linux
const API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Map API response to a label
 * @param isAI - Whether the image is detected as AI-generated
 * @param confidence - Confidence score between 0 and 1
 * @returns Label string
 */
function mapToLabel(isAI: boolean, confidence: number): DetectionResult['label'] {
  // If confidence is low, mark as unclear
  if (confidence < 0.6) {
    return 'Unclear';
  }
  return isAI ? 'Likely AI' : 'Likely Real';
}

/**
 * Fetch detection result from the classifier API
 * 
 * @param _imageBuffer - JPEG image buffer (unused, fileWatcher sends images separately)
 * @param postId - Unique identifier for the post
 * @returns Detection result with score and label
 */
export async function detectAI(_imageBuffer: Buffer, postId: string): Promise<DetectionResult> {
  const apiUrl = `${API_BASE_URL}/analyze/${postId}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    // Handle 404 - analysis not yet complete
    if (response.status === 404) {
      console.log(`[Detector] Post ${postId}: Analysis not ready yet`);
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
    
    console.log(`[Detector] Post ${postId}: is_ai=${data.is_ai}, confidence=${(data.confidence * 100).toFixed(1)}%, severity=${data.severity}, label=${label}`);

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
      console.error(`[Detector] Error fetching result for post ${postId}:`, error);
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
