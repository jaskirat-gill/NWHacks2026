import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { analyzeScreenshot } from './src/services/geminiVision';
import { analyzeThreats } from './src/services/geminiText';
import { checkURLSafety } from './src/services/safeBrowsing';
import { calculateRisk } from './src/services/riskCalculator';
import { captureScreen } from './src/utils/screenCapture';
import dotenv from 'dotenv';

dotenv.config();

interface ThreatEntry {
  id: number;
  timestamp: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  description: string;
  screenshot: string;
  coordinates: { x: number; y: number };
  indicators: string[];
  threatType: string;
}

let controlPanelWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let monitoringInterval: NodeJS.Timeout | null = null;
let isMonitoring = false;
let threatLog: ThreatEntry[] = [];

function createControlPanelWindow(): void {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const preloadPath = isDev 
    ? path.join(__dirname, 'dist-electron/preload.js')
    : path.join(__dirname, 'preload.js');
  
  controlPanelWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the React app
  if (isDev) {
    controlPanelWindow.loadURL('http://localhost:5173');
    controlPanelWindow.webContents.openDevTools();
  } else {
    controlPanelWindow.loadFile('dist/index.html');
  }

  controlPanelWindow.on('closed', () => {
    controlPanelWindow = null;
    if (overlayWindow) {
      overlayWindow.close();
    }
  });
}

function createOverlayWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const preloadPath = isDev 
    ? path.join(__dirname, 'dist-electron/preload.js')
    : path.join(__dirname, 'preload.js');

  overlayWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Make window click-through except for interactive elements
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load the overlay React app
  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173?overlay=true');
  } else {
    overlayWindow.loadFile('dist/index.html', { query: { overlay: 'true' } });
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

async function processScreenshot(): Promise<void> {
  if (!isMonitoring) return;

  try {
    // Capture screen
    const screenshot = await captureScreen();
    if (!screenshot) {
      console.log('Failed to capture screen');
      return;
    }

    // Analyze with Gemini Vision
    const visionResult = await analyzeScreenshot(screenshot);
    
    if (!visionResult.isAI) {
      return; // No AI content detected, skip further analysis
    }

    // Analyze threats in detected text
    let threatAnalysis: { threatType: 'scam' | 'phishing' | 'deepfake' | 'none'; indicators: string[]; severity: 'high' | 'medium' | 'low' } = { 
      threatType: 'none', 
      indicators: [], 
      severity: 'low' 
    };
    if (visionResult.detectedText) {
      threatAnalysis = await analyzeThreats(visionResult.detectedText);
    }

    // Check URLs if found
    let urlSafety = { isSafe: true, threatTypes: [] as string[] };
    if (visionResult.detectedURLs && visionResult.detectedURLs.length > 0) {
      for (const url of visionResult.detectedURLs) {
        const safety = await checkURLSafety(url);
        if (!safety.isSafe) {
          urlSafety = safety;
          break;
        }
      }
    }

    // Calculate risk score
    const riskResult = calculateRisk({
      aiConfidence: visionResult.confidence,
      threatIndicators: threatAnalysis.indicators,
      threatType: threatAnalysis.threatType,
      urlSafety: urlSafety,
      detectedURLs: visionResult.detectedURLs,
    });

    // Create threat entry
    const threatEntry: ThreatEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      riskLevel: riskResult.level,
      score: riskResult.score,
      description: riskResult.reasons.join(', '),
      screenshot: screenshot,
      coordinates: { x: 0, y: 0 }, // Will be enhanced with actual detection coordinates
      indicators: threatAnalysis.indicators,
      threatType: threatAnalysis.threatType,
    };

    // Add to threat log
    threatLog.unshift(threatEntry);
    if (threatLog.length > 100) {
      threatLog = threatLog.slice(0, 100); // Keep last 100 entries
    }

    // Send to control panel
    if (controlPanelWindow) {
      controlPanelWindow.webContents.send('threat-detected', threatEntry);
    }

    // Update overlay with badge
    if (overlayWindow && riskResult.level !== 'LOW') {
      overlayWindow.webContents.send('overlay-update', {
        riskLevel: riskResult.level,
        coordinates: threatEntry.coordinates,
        id: threatEntry.id,
      });
    }

  } catch (error) {
    console.error('Error processing screenshot:', error);
    if (controlPanelWindow) {
      controlPanelWindow.webContents.send('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// IPC Handlers
ipcMain.handle('start-monitoring', async () => {
  if (isMonitoring) {
    return { success: false, message: 'Already monitoring' };
  }

  isMonitoring = true;
  
  // Create overlay window if it doesn't exist
  if (!overlayWindow) {
    createOverlayWindow();
  }

  // Start capture loop (every 3 seconds)
  monitoringInterval = setInterval(() => {
    processScreenshot();
  }, 3000);

  // Send initial status
  if (controlPanelWindow) {
    controlPanelWindow.webContents.send('monitoring-status', { isMonitoring: true });
  }

  return { success: true, message: 'Monitoring started' };
});

ipcMain.handle('stop-monitoring', async () => {
  if (!isMonitoring) {
    return { success: false, message: 'Not monitoring' };
  }

  isMonitoring = false;
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  if (controlPanelWindow) {
    controlPanelWindow.webContents.send('monitoring-status', { isMonitoring: false });
  }

  return { success: true, message: 'Monitoring stopped' };
});

ipcMain.handle('get-threats', async () => {
  return threatLog;
});

ipcMain.handle('update-overlay', async (event, data) => {
  if (overlayWindow) {
    overlayWindow.webContents.send('update-overlay', data);
  }
});

app.whenReady().then(() => {
  createControlPanelWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlPanelWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  isMonitoring = false;
});

