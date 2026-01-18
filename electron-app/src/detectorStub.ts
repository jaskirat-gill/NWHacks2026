import { DetectionResult } from './types';

/**
 * Simple hash function for generating deterministic scores from image bytes
 * @param buffer - Image buffer to hash
 * @returns Hash value
 */
function hashBuffer(buffer: Buffer): number {
  let hash = 0;
  // Sample every 100th byte for performance (don't need to hash entire image)
  const step = Math.max(1, Math.floor(buffer.length / 1000));
  
  for (let i = 0; i < buffer.length; i += step) {
    hash = ((hash << 5) - hash + buffer[i]) >>> 0;
  }
  
  return hash;
}

/**
 * Map a score to a label
 * @param score - Score between 0 and 1
 * @returns Label string
 */
function scoreToLabel(score: number): DetectionResult['label'] {
  if (score >= 0.75) {
    return 'Likely AI';
  } else if (score >= 0.45) {
    return 'Unclear';
  } else {
    return 'Likely Real';
  }
}

/**
 * Stub detector that returns a deterministic fake score based on image hash
 * This can be easily replaced with a real API call later
 * 
 * @param imageBuffer - JPEG image buffer to analyze
 * @param postId - Unique identifier for the post
 * @returns Detection result with score and label
 */
export async function detectAI(imageBuffer: Buffer, postId: string): Promise<DetectionResult> {
  // Simulate some processing time (remove this when using real API)
  await new Promise(resolve => setTimeout(resolve, 300));

  // Generate deterministic score from image hash
  const hash = hashBuffer(imageBuffer);
  const score = (hash % 100) / 100;

  const label = scoreToLabel(score);

  console.log(`[DetectorStub] Post ${postId}: score=${score.toFixed(2)}, label=${label}`);

  return {
    postId,
    score,
    label,
    timestamp: Date.now(),
  };
}

/**
 * Placeholder for real detector API call
 * Replace this function body when the real detector is ready
 * 
 * @param imageBuffer - JPEG image buffer to analyze
 * @param postId - Unique identifier for the post
 * @param apiEndpoint - API endpoint URL
 * @returns Detection result with score and label
 */
export async function detectAIReal(
  imageBuffer: Buffer,
  postId: string,
  apiEndpoint: string
): Promise<DetectionResult> {
  // TODO: Implement real API call
  // Example:
  // const response = await fetch(apiEndpoint, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/octet-stream' },
  //   body: imageBuffer,
  // });
  // const data = await response.json();
  // return {
  //   postId,
  //   score: data.score,
  //   label: scoreToLabel(data.score),
  //   timestamp: Date.now(),
  // };

  // For now, fall back to stub
  console.warn('[Detector] Real API not implemented, using stub');
  return detectAI(imageBuffer, postId);
}
