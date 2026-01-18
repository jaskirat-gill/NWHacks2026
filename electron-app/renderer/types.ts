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
