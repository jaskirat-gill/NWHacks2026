import axios from 'axios';

const API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
const API_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

export interface URLSafetyResult {
  isSafe: boolean;
  threatTypes: string[];
}

/**
 * Check URL safety using Google Safe Browsing API
 * @param url - URL to check
 * @returns Safety result with threat types if unsafe
 */
export async function checkURLSafety(url: string): Promise<URLSafetyResult> {
  if (!API_KEY) {
    console.warn('Safe Browsing API key not configured, assuming URL is safe');
    return { isSafe: true, threatTypes: [] };
  }

  try {
    // Extract domain from URL if needed
    let urlToCheck = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      urlToCheck = `https://${url}`;
    }

    const requestBody = {
      client: {
        clientId: 'realitycheck',
        clientVersion: '1.0.0',
      },
      threatInfo: {
        threatTypes: [
          'MALWARE',
          'SOCIAL_ENGINEERING',
          'UNWANTED_SOFTWARE',
          'POTENTIALLY_HARMFUL_APPLICATION',
        ],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url: urlToCheck }],
      },
    };

    const response = await axios.post<{
      matches?: Array<{ threatType: string }>;
    }>(
      `${API_URL}?key=${API_KEY}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    if (response.data && response.data.matches && response.data.matches.length > 0) {
      const threatTypes = response.data.matches.map(match => match.threatType);
      return {
        isSafe: false,
        threatTypes: threatTypes,
      };
    }

    return { isSafe: true, threatTypes: [] };
  } catch (error) {
    console.error('Safe Browsing API error:', error instanceof Error ? error.message : 'Unknown error');
    // On error, assume safe to avoid false positives
    return { isSafe: true, threatTypes: [] };
  }
}

