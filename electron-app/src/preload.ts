import { contextBridge, ipcRenderer } from 'electron';
import { OverlayState, EducationData } from './types';

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
  requestEducation: (postId: string): Promise<EducationData> => {
    return ipcRenderer.invoke('request-education', postId);
  },
});
