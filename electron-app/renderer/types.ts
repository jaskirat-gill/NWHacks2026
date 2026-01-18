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

// Augment the global Window interface with electronAPI from preload
declare global {
  interface Window {
    electronAPI: {
      onOverlayUpdate: (callback: (state: OverlayState) => void) => void;
      setIgnoreMouseEvents: (ignore: boolean) => void;
    };
  }
}
