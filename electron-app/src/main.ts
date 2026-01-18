import { app, BrowserWindow, screen, globalShortcut, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { DomSensorMessage, DetectionResult, OverlayState, EducationData } from './types';
import { captureAndCrop, saveDebugScreenshot, CropRegion } from './screenshot';
import { startFileWatcher, stopFileWatcher } from './fileWatcher';

// API base URL
const API_BASE_URL = 'http://127.0.0.1:8000';
const WS_API_BASE_URL = 'ws://127.0.0.1:8000';

// State
let overlayWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null;
let wsServer: WebSocketServer | null = null;
let currentPost: DomSensorMessage | null = null;
let detectionCache: Map<string, DetectionResult> = new Map();
let lastDetectionTime = 0;
let detectionInFlight = false;
let lastScreenshotBuffer: Buffer | null = null;
let showDebugBox = true;  // Toggle with Cmd+Shift+D
let detectionEnabled = true;  // Detection enabled/disabled state

// WebSocket connection to FastAPI for push notifications
let apiWebSocket: WebSocket | null = null;
let currentApiPostId: string | null = null;

// Extract base post ID (just "post_X" part)
function extractBasePostId(fullPostId: string): string {
  const match = fullPostId.match(/^(post_\d+)/);
  if (match) {
    return match[1];
  }
  return fullPostId;
}

// Connect to FastAPI WebSocket for push notifications
function connectApiWebSocket(postId: string): void {
  // Extract base post ID to match what fileWatcher sends to the API
  const basePostId = extractBasePostId(postId);
  
  // If already connected for this post, no need to reconnect
  if (apiWebSocket && currentApiPostId === basePostId) {
    return;
  }
  
  // Disconnect previous connection if exists
  disconnectApiWebSocket();
  
  const wsUrl = `${WS_API_BASE_URL}/ws/analysis/${basePostId}`;
  console.log(`[WebSocket] Connecting to ${wsUrl} for post ${postId} (base: ${basePostId})`);
  
  try {
    apiWebSocket = new WebSocket(wsUrl);
    currentApiPostId = basePostId;
    
    apiWebSocket.on('open', () => {
      console.log(`[WebSocket] Connected to FastAPI WebSocket for ${basePostId}`);
    });
    
    apiWebSocket.on('message', (data: Buffer) => {
      try {
        const resultData = JSON.parse(data.toString());
        console.log(`[WebSocket] Received push notification for ${basePostId}:`, resultData);
        
        // Find the current post that matches this basePostId
        const post = currentPost?.post;
        if (!post) {
          console.log(`[WebSocket] Received result for ${basePostId}, but no current post. Ignoring.`);
          return;
        }
        
        const currentPostId = post.id;
        if (extractBasePostId(currentPostId) !== basePostId) {
          console.log(`[WebSocket] Received result for ${basePostId}, but current post doesn't match. Ignoring.`);
          return;
        }
        
        // Map API response to DetectionResult format
        const result: DetectionResult = {
          postId: currentPostId, // Use full post ID from current post
          score: resultData.confidence || 0,
          label: mapApiResponseToLabel(resultData.is_ai, resultData.confidence),
          timestamp: Date.now(),
        };
        
        // Cache the result
        detectionCache.set(currentPostId, result);
        
        // Update overlay (post is guaranteed to be non-null after the check above)
        updateOverlayWithDetection(post, result);
        // Stop screenshot loop once we have a result
        stopScreenshotLoop();
      } catch (err) {
        console.error(`[WebSocket] Error parsing push notification:`, err);
      }
    });
    
    apiWebSocket.on('error', (error) => {
      console.error(`[WebSocket] Error for ${basePostId}:`, error);
    });
    
    apiWebSocket.on('close', () => {
      console.log(`[WebSocket] Disconnected from FastAPI WebSocket for ${basePostId}`);
      if (currentApiPostId === basePostId) {
        apiWebSocket = null;
        currentApiPostId = null;
      }
    });
  } catch (err) {
    console.error(`[WebSocket] Failed to connect to ${wsUrl}:`, err);
    apiWebSocket = null;
    currentApiPostId = null;
  }
}

// Disconnect from FastAPI WebSocket
function disconnectApiWebSocket(): void {
  if (apiWebSocket) {
    console.log(`[WebSocket] Disconnecting from FastAPI WebSocket for ${currentApiPostId}`);
    apiWebSocket.removeAllListeners();
    apiWebSocket.close();
    apiWebSocket = null;
    currentApiPostId = null;
  }
}

// Map API response to DetectionResult label format
function mapApiResponseToLabel(isAI: boolean, confidence: number): DetectionResult['label'] {
  // Low confidence = unclear
  if (confidence < 0.6) {
    return 'Unclear';
  }
  
  if (isAI) {
    // AI detected - differentiate by confidence
    if (confidence >= 0.8) {
      return 'Likely AI';      // High confidence AI
    }
    return 'Possibly AI';      // Medium confidence AI
  }
  
  // Not AI detected
  return 'Likely Real';
}

// Continuous screenshot loop state
let screenshotLoop: NodeJS.Timeout | null = null;
let screenshotStartDelay: NodeJS.Timeout | null = null;
let currentScreenshotPostId: string | null = null;
let frameCounter = 0;

const DETECTION_THROTTLE_MS = 2000;
const CACHE_TTL_MS = 5000;
const SCREENSHOT_INTERVAL_MS = 1000; // Capture every 1 second
const SCREENSHOT_START_DELAY_MS = 200; // Minimal delay for scroll settle (was 800ms)

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

// Create control window
function createControlWindow(): void {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.focus();
    return;
  }

  controlWindow = new BrowserWindow({
    width: 600,
    height: 800,
    frame: true,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: 'Reality Check - Control Panel',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load control window HTML
  controlWindow.loadFile(path.join(__dirname, 'renderer', 'control.html'));

  controlWindow.on('closed', () => {
    controlWindow = null;
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
    // No active post, stop screenshot loop, disconnect WebSocket, and hide overlay
    stopScreenshotLoop();
    disconnectApiWebSocket();
    updateOverlay({
      visible: false,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      label: '',
      score: 0,
      postId: null,
      showDebugBox: false,
    });
    return;
  }

  const { post, dpr } = message;

  if (detectionEnabled) {
  // Check cache for existing detection (with valid, non-Analyzing result)
  const cached = detectionCache.get(post.id);
  if (cached && cached.label !== 'Analyzing...' && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    // Use cached result - no need to start screenshot loop or WebSocket
    updateOverlayWithDetection(post, cached);
    return;
  }

  // Connect to WebSocket for push notifications when analysis completes
  connectApiWebSocket(post.id);

  // No valid cached result - start screenshot capture for this post
  startScreenshotLoop(message);
  }
  // Show "Analyzing..." while waiting
  updateOverlay({
    visible: true,
    x: post.x,
    y: post.y,
    w: post.w,
    h: post.h,
    label: 'Analyzing...',
    score: 0,
    postId: post.id,
    showDebugBox: showDebugBox,
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
    const { post, dpr } = message;

    // Capture and crop screenshot
    const cropRegion: CropRegion = {
      x: post.x,
      y: post.y,
      w: post.w,
      h: post.h,
      dpr: dpr,
    };

    console.log(`[Screenshot] Capturing region: x=${post.x}, y=${post.y}, w=${post.w}, h=${post.h}, dpr=${dpr}`);
    const screenshot = await captureAndCrop(cropRegion);

    if (!screenshot) {
      console.error('Failed to capture screenshot');
      detectionInFlight = false;
      return;
    }

    // Store for debug saving
    lastScreenshotBuffer = screenshot.buffer;
    console.log(`[Screenshot] Captured ${screenshot.width}x${screenshot.height}, ${screenshot.buffer.length} bytes`);

    // Note: Results are now received via WebSocket push notifications
    // triggerDetection is mainly for initial screenshot capture
    // The actual result will come via WebSocket when analysis completes
  } catch (err) {
    console.error('Detection error:', err);
  } finally {
    detectionInFlight = false;
  }
}

// Update overlay with detection result
function updateOverlayWithDetection(
  post: { x: number; y: number; w: number; h: number },
  result: DetectionResult
): void {
  updateOverlay({
    visible: true,
    x: post.x,
    y: post.y,
    w: post.w,
    h: post.h,
    label: result.label,
    score: result.score,
    postId: result.postId,
    showDebugBox: showDebugBox,
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

// ============ Continuous Screenshot Loop ============

// Stop the screenshot loop and any pending start delay
function stopScreenshotLoop(): void {
  if (screenshotStartDelay) {
    clearTimeout(screenshotStartDelay);
    screenshotStartDelay = null;
  }
  if (screenshotLoop) {
    clearInterval(screenshotLoop);
    screenshotLoop = null;
    console.log(`[ScreenshotLoop] Stopped. Captured ${frameCounter} frames for post ${currentScreenshotPostId}`);
  }
  currentScreenshotPostId = null;
}

// Capture a single frame, save to disk, and fetch latest detection result
async function captureFrame(message: DomSensorMessage): Promise<void> {
  if (!message.post) return;

  const { post, dpr } = message;

  // Check if we already have a cached result for this post
  const cached = detectionCache.get(post.id);
  if (cached && cached.label !== 'Analyzing...') {
    // Already have a result, just update overlay and stop the loop
    console.log(`[ScreenshotLoop] Already have result for ${post.id}, stopping capture loop`);
    updateOverlayWithDetection(post, cached);
    stopScreenshotLoop();
    return;
  }

  const cropRegion: CropRegion = {
    x: post.x,
    y: post.y,
    w: post.w,
    h: post.h,
    dpr: dpr,
  };

  const screenshot = await captureAndCrop(cropRegion);
  if (screenshot) {
    // Save with post ID and frame number
    const filename = `${post.id}_frame${frameCounter}_${Date.now()}.jpg`;
    await saveDebugScreenshot(screenshot.buffer, filename);
    console.log(`[ScreenshotLoop] Saved frame ${frameCounter} for post ${post.id}`);
    frameCounter++;

    // Also store for debug saving via hotkey
    lastScreenshotBuffer = screenshot.buffer;

    // Note: Results are now received via WebSocket push notifications
    // No need to poll here - WebSocket will handle result delivery
    // The screenshot loop just saves frames for debugging/education purposes
  }
}

// Start continuous screenshot capture for a post (with delay for scroll to settle)
function startScreenshotLoop(message: DomSensorMessage): void {
  if (!message.post || !detectionEnabled) return;

  // If already capturing or waiting to capture for this post, do nothing
  if (currentScreenshotPostId === message.post.id && (screenshotLoop || screenshotStartDelay)) {
    return;
  }

  // Stop any existing loop
  stopScreenshotLoop();

  currentScreenshotPostId = message.post.id;
  frameCounter = 0;

  console.log(`[ScreenshotLoop] New post ${message.post.id} - waiting ${SCREENSHOT_START_DELAY_MS}ms for scroll to settle...`);

  // Wait for scroll to settle before starting capture
  screenshotStartDelay = setTimeout(() => {
    screenshotStartDelay = null;
    
    // Verify we're still on the same post after the delay
    if (currentPost?.post?.id !== currentScreenshotPostId) {
      console.log(`[ScreenshotLoop] Post changed during delay, cancelling`);
      stopScreenshotLoop();
      return;
    }

    console.log(`[ScreenshotLoop] Starting capture for post ${currentScreenshotPostId}`);

    // Capture first frame
    captureFrame(currentPost);

    // Then capture every SCREENSHOT_INTERVAL_MS
    screenshotLoop = setInterval(() => {
      // Check if we're still on the same post
      if (currentPost?.post?.id === currentScreenshotPostId) {
        captureFrame(currentPost);
      } else {
        // Post changed or disappeared, stop the loop
        stopScreenshotLoop();
      }
    }, SCREENSHOT_INTERVAL_MS);
  }, SCREENSHOT_START_DELAY_MS);
}

// ============ End Continuous Screenshot Loop ============

// Debug: Save current screenshot to disk
async function saveCurrentScreenshot(): Promise<void> {
  if (lastScreenshotBuffer) {
    const filename = `debug_${currentPost?.post?.id || 'unknown'}_${Date.now()}.jpg`;
    await saveDebugScreenshot(lastScreenshotBuffer, filename);
  } else if (currentPost?.post) {
    // No cached screenshot, capture a new one
    const { post, dpr } = currentPost;
    const cropRegion: CropRegion = {
      x: post.x,
      y: post.y,
      w: post.w,
      h: post.h,
      dpr: dpr,
    };
    
    const screenshot = await captureAndCrop(cropRegion);
    if (screenshot) {
      const filename = `debug_${post.id}_${Date.now()}.jpg`;
      await saveDebugScreenshot(screenshot.buffer, filename);
    }
  } else {
    console.log('No active post to screenshot');
  }
}

// Toggle debug box visibility
function toggleDebugBox(): void {
  showDebugBox = !showDebugBox;
  console.log(`Debug box: ${showDebugBox ? 'ON' : 'OFF'}`);
  
  // Re-send current overlay state with new debug setting
  if (currentPost?.post) {
    const cached = detectionCache.get(currentPost.post.id);
    if (cached) {
      updateOverlayWithDetection(currentPost.post, cached);
    } else {
      updateOverlay({
        visible: true,
        x: currentPost.post.x,
        y: currentPost.post.y,
        w: currentPost.post.w,
        h: currentPost.post.h,
        label: 'Analyzing...',
        score: 0,
        postId: currentPost.post.id,
        showDebugBox: showDebugBox,
      });
    }
  }
}

// Fetch educational content from the API
async function fetchEducation(postId: string): Promise<EducationData> {
  const basePostId = extractBasePostId(postId);
  const apiUrl = `${API_BASE_URL}/educate/${basePostId}`;
  
  console.log(`[Education] Fetching: ${apiUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json() as EducationData;
    console.log(`[Education] Received ${data.frames.length} frames and explanation`);
    
    return data;
  } catch (error: any) {
    console.error(`[Education] Error fetching education for ${basePostId}:`, error);
    throw error;
  }
}

// App lifecycle
app.whenReady().then(() => {
  createOverlayWindow();
  createControlWindow();
  startWebSocketServer();
  startFileWatcher(); // Start watching screenshots folder

  // Handle mouse events toggle from renderer (for clickable badge)
  ipcMain.on('set-ignore-mouse-events', (_event, ignore: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  // Handle education request from renderer
  ipcMain.handle('request-education', async (_event, postId: string) => {
    console.log(`[IPC] Education requested for post: ${postId}`);
    try {
      const educationData = await fetchEducation(postId);
      return educationData;
    } catch (error: any) {
      console.error(`[IPC] Education request failed:`, error);
      throw error;
    }
  });

  // Register debug shortcut (Cmd+Shift+S to save screenshot)
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    console.log('Debug screenshot requested');
    saveCurrentScreenshot();
  });

  // Register debug box toggle (Cmd+Shift+D)
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    toggleDebugBox();
  });

  console.log('Shortcuts registered:');
  console.log('  Cmd+Shift+S: Save debug screenshot');
  console.log('  Cmd+Shift+D: Toggle debug bounding box');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
      createControlWindow();
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
  stopScreenshotLoop();
  disconnectApiWebSocket();
  stopFileWatcher();
  if (wsServer) {
    wsServer.close();
  }
});
