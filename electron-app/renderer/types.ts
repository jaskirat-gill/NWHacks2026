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
