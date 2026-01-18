import { contextBridge, ipcRenderer } from 'electron';
import { OverlayState } from './types';

// Expose IPC to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  onOverlayUpdate: (callback: (state: OverlayState) => void) => {
    ipcRenderer.on('overlay-update', (_event, state: OverlayState) => {
      callback(state);
    });
  },
  toggleDetection: (): Promise<{ enabled: boolean }> => {
    return ipcRenderer.invoke('toggle-detection');
  },
  getDetectionState: (): Promise<{ enabled: boolean }> => {
    return ipcRenderer.invoke('get-detection-state');
  },
  getScreenshots: (): Promise<{ [postId: string]: string[] }> => {
    return ipcRenderer.invoke('get-screenshots');
  },
  getScreenshotsDir: (): Promise<string> => {
    return ipcRenderer.invoke('get-screenshots-dir');
  },
  onDetectionStateChanged: (callback: (state: { enabled: boolean }) => void) => {
    ipcRenderer.on('detection-state-changed', (_event, state: { enabled: boolean }) => {
      callback(state);
    });
  },
});
