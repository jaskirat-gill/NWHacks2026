import { app, BrowserWindow, screen, ipcMain, globalShortcut } from 'electron';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { DomSensorMessage, DetectionResult, OverlayState } from './types';

// State
let overlayWindow: BrowserWindow | null = null;
let wsServer: WebSocketServer | null = null;
let currentPost: DomSensorMessage | null = null;
let detectionCache: Map<string, DetectionResult> = new Map();
let lastDetectionTime = 0;
let detectionInFlight = false;

const DETECTION_THROTTLE_MS = 2000;
const CACHE_TTL_MS = 5000;

// Create transparent overlay window
function createOverlayWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Make window click-through
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load React overlay
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// Start WebSocket server
function startWebSocketServer(): void {
  wsServer = new WebSocketServer({ port: 8765 });

  console.log('WS server listening on 8765');

  wsServer.on('connection', (ws: WebSocket) => {
    console.log('DOM sensor connected');

    ws.on('message', (data: Buffer) => {
      try {
        const message: DomSensorMessage = JSON.parse(data.toString());
        handleDomSensorMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      console.log('DOM sensor disconnected');
    });
  });

  wsServer.on('error', (err) => {
    console.error('WebSocket server error:', err);
  });
}

// Handle incoming DOM sensor message
function handleDomSensorMessage(message: DomSensorMessage): void {
  currentPost = message;

  if (!message.post) {
    // No active post, hide overlay
    updateOverlay({
      visible: false,
      x: 0,
      y: 0,
      label: '',
      score: 0,
      postId: null,
    });
    return;
  }

  const { post, dpr } = message;

  // Check cache for existing detection
  const cached = detectionCache.get(post.id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    // Use cached result
    updateOverlayWithDetection(post, cached, dpr);
    return;
  }

  // Show "Analyzing..." while waiting
  updateOverlay({
    visible: true,
    x: post.x + post.w - 120,
    y: post.y + 10,
    label: 'Analyzing...',
    score: 0,
    postId: post.id,
  });

  // Trigger detection (throttled)
  triggerDetection(message);
}

// Trigger detection with throttling
async function triggerDetection(message: DomSensorMessage): Promise<void> {
  if (!message.post) return;

  const now = Date.now();
  if (detectionInFlight || now - lastDetectionTime < DETECTION_THROTTLE_MS) {
    return;
  }

  detectionInFlight = true;
  lastDetectionTime = now;

  try {
    // TODO: Chunk 3 will implement actual screenshot + detection
    // For now, use a placeholder that simulates detection
    const result = await simulateDetection(message.post.id);

    // Cache the result
    detectionCache.set(message.post.id, result);

    // Clean old cache entries
    cleanCache();

    // Update overlay if this is still the current post
    if (currentPost?.post?.id === message.post.id) {
      updateOverlayWithDetection(message.post, result, message.dpr);
    }
  } catch (err) {
    console.error('Detection error:', err);
  } finally {
    detectionInFlight = false;
  }
}

// Placeholder detection - will be replaced in Chunk 3
async function simulateDetection(postId: string): Promise<DetectionResult> {
  // Simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Deterministic fake score based on post ID hash
  let hash = 0;
  for (let i = 0; i < postId.length; i++) {
    hash = (hash * 31 + postId.charCodeAt(i)) >>> 0;
  }
  const score = (hash % 100) / 100;

  let label: DetectionResult['label'];
  if (score >= 0.75) {
    label = 'Likely AI';
  } else if (score >= 0.45) {
    label = 'Unclear';
  } else {
    label = 'Likely Real';
  }

  return {
    postId,
    score,
    label,
    timestamp: Date.now(),
  };
}

// Update overlay with detection result
function updateOverlayWithDetection(
  post: { x: number; y: number; w: number; h: number },
  result: DetectionResult,
  _dpr: number
): void {
  updateOverlay({
    visible: true,
    x: post.x + post.w - 120,
    y: post.y + 10,
    label: result.label,
    score: result.score,
    postId: result.postId,
  });
}

// Send update to overlay renderer
function updateOverlay(state: OverlayState): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay-update', state);
  }
}

// Clean expired cache entries
function cleanCache(): void {
  const now = Date.now();
  for (const [key, value] of detectionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      detectionCache.delete(key);
    }
  }
}

// App lifecycle
app.whenReady().then(() => {
  createOverlayWindow();
  startWebSocketServer();

  // Register debug shortcut (Cmd+Shift+S to save screenshot)
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    console.log('Debug screenshot requested - will be implemented in Chunk 3');
    // TODO: Chunk 3 will implement screenshot saving
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (wsServer) {
    wsServer.close();
  }
});
