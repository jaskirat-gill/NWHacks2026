export interface OverlayState {
  visible: boolean;
  x: number;
  y: number;
  w: number;      // width of post region
  h: number;      // height of post region
  label: string;
  score: number;
  postId: string | null;
  showDebugBox: boolean;  // whether to show the debug bounding box
}

// Educational content returned from the Gemini API
export interface EducationData {
  frames: string[];           // base64 encoded JPEG images
  explanation: string;        // Gemini-generated educational text
  indicators: string[];       // Key visual indicators found
  detection_summary: {
    is_ai: boolean;
    confidence: number;
    severity: string;
  };
}

// Augment the global Window interface with electronAPI from preload
declare global {
  interface Window {
    electronAPI: {
      onOverlayUpdate: (callback: (state: OverlayState) => void) => void;
      setIgnoreMouseEvents: (ignore: boolean) => void;
      requestEducation: (postId: string) => Promise<EducationData>;
    };
  }
}

export interface ElectronAPI {
  onOverlayUpdate: (callback: (state: OverlayState) => void) => void;
  toggleDetection: () => Promise<{ enabled: boolean }>;
  getDetectionState: () => Promise<{ enabled: boolean }>;
  getScreenshots: () => Promise<{ [postId: string]: string[] }>;
  getScreenshotsDir: () => Promise<string>;
  onDetectionStateChanged: (callback: (state: { enabled: boolean }) => void) => void;
  setIgnoreMouseEvents: (ignore: boolean) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface ThreatEntry {
  id: number;
  timestamp: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  description: string;
  screenshot: string;
  coordinates: { x: number; y: number };
  indicators: string[];
  threatType: string;
  is_ai: boolean; // Track if content is detected as AI-generated
}
