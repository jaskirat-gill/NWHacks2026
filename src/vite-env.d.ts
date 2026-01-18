/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    startMonitoring: () => Promise<{ success: boolean; message: string }>;
    stopMonitoring: () => Promise<{ success: boolean; message: string }>;
    onThreatDetected: (callback: (data: any) => void) => void;
    getThreatLog: () => Promise<any[]>;
    updateOverlay: (data: any) => Promise<void>;
    onMonitoringStatus: (callback: (status: { isMonitoring: boolean }) => void) => void;
    onOverlayUpdate: (callback: (data: any) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
}

