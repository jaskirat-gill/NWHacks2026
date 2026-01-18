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
}
