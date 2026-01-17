/**
 * Extract URLs from text using regex
 * @param text - Text to extract URLs from
 * @returns Array of found URLs
 */
export function extractURLs(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
  const matches = text.match(urlRegex);
  return matches ? matches.filter(url => {
    // Filter out common false positives
    const lower = url.toLowerCase();
    return !lower.endsWith('.') && !lower.endsWith(',') && !lower.endsWith('!');
  }) : [];
}

