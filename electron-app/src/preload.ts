import { contextBridge, ipcRenderer } from 'electron';
import { OverlayState } from './types';

// Expose IPC to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  onOverlayUpdate: (callback: (state: OverlayState) => void) => {
    ipcRenderer.on('overlay-update', (_event, state: OverlayState) => {
      callback(state);
    });
  },
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
});
