import { contextBridge, ipcRenderer } from 'electron';

export interface ThreatEntry {
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

export interface OverlayData {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  coordinates: { x: number; y: number };
  id: number;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  onThreatDetected: (callback: (data: ThreatEntry) => void) => {
    ipcRenderer.on('threat-detected', (event, data) => callback(data));
  },
  getThreatLog: () => ipcRenderer.invoke('get-threats') as Promise<ThreatEntry[]>,
  updateOverlay: (data: OverlayData) => ipcRenderer.invoke('update-overlay', data),
  onMonitoringStatus: (callback: (status: { isMonitoring: boolean }) => void) => {
    ipcRenderer.on('monitoring-status', (event, status) => callback(status));
  },
  onOverlayUpdate: (callback: (data: OverlayData) => void) => {
    ipcRenderer.on('overlay-update', (event, data) => callback(data));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// Type declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      startMonitoring: () => Promise<{ success: boolean; message: string }>;
      stopMonitoring: () => Promise<{ success: boolean; message: string }>;
      onThreatDetected: (callback: (data: ThreatEntry) => void) => void;
      getThreatLog: () => Promise<ThreatEntry[]>;
      updateOverlay: (data: OverlayData) => Promise<void>;
      onMonitoringStatus: (callback: (status: { isMonitoring: boolean }) => void) => void;
      onOverlayUpdate: (callback: (data: OverlayData) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

