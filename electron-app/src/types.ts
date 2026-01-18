// Shared TypeScript interfaces for TikTok AI Detector

export interface ActivePost {
  id: string;
  x: number;      // screen X coordinate
  y: number;      // screen Y coordinate
  w: number;      // width in CSS pixels
  h: number;      // height in CSS pixels
  visibility: number; // 0-1 intersection ratio
}

export interface DomSensorMessage {
  site: string;
  dpr: number;              // devicePixelRatio
  windowScreenX: number;    // window.screenX
  windowScreenY: number;    // window.screenY
  post: ActivePost | null;  // null if no active post
}

export interface DetectionResult {
  postId: string;
  score: number;            // 0-1 confidence score
  label: 'Likely AI' | 'Unclear' | 'Likely Real';
  timestamp: number;
}

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
