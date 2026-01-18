import React, { useState, useEffect } from 'react';
import ThreatLog from './components/ThreatLog';
import Settings from './components/Settings';

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

export default function ControlPanel() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [threats, setThreats] = useState<ThreatEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if electronAPI is available
    if (!window.electronAPI) {
      setError('Electron API not available. Make sure you are running in Electron.');
      return;
    }

    // Load initial threat log
    window.electronAPI.getThreatLog().then(setThreats).catch((err: Error) => {
      console.error('Failed to load threat log:', err);
    });

    // Listen for new threats
    window.electronAPI.onThreatDetected((threat: ThreatEntry) => {
      setThreats(prev => [threat, ...prev]);
    });

    // Listen for monitoring status changes
    window.electronAPI.onMonitoringStatus((status: { isMonitoring: boolean }) => {
      setIsMonitoring(status.isMonitoring);
    });

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('threat-detected');
        window.electronAPI.removeAllListeners('monitoring-status');
      }
    };
  }, []);

  const handleStartMonitoring = async () => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return;
    }
    try {
      const result = await window.electronAPI.startMonitoring();
      if (result.success) {
        setIsMonitoring(true);
        setError(null);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start monitoring');
    }
  };

  const handleStopMonitoring = async () => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return;
    }
    try {
      const result = await window.electronAPI.stopMonitoring();
      if (result.success) {
        setIsMonitoring(false);
        setError(null);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop monitoring');
    }
  };

  // Show error if electronAPI is not available
  if (!window.electronAPI) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-blue-400 mb-4">RealityCheck</h1>
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
            <p className="text-red-200 font-semibold mb-2">Electron API Not Available</p>
            <p className="text-red-300 text-sm">
              The Electron preload script is not loaded. Make sure you are running this application in Electron, not in a regular browser.
            </p>
            <p className="text-gray-400 text-xs mt-2">
              If you are running in Electron, check the console for errors and verify that the preload script is being loaded correctly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-blue-400">RealityCheck</h1>
          <p className="text-gray-400 mt-2">Security-Focused Social Media Threat Detector</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Section */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Monitoring Control</h2>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className="text-sm text-gray-300">
                    {isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive'}
                  </span>
                </div>

                {!isMonitoring ? (
                  <button
                    onClick={handleStartMonitoring}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    Start Monitoring
                  </button>
                ) : (
                  <button
                    onClick={handleStopMonitoring}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    Stop Monitoring
                  </button>
                )}

                {error && (
                  <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-sm text-red-200">
                    {error}
                  </div>
                )}
              </div>
            </div>

            <Settings />
          </div>

          {/* Threat Log Section */}
          <div className="lg:col-span-2">
            <ThreatLog threats={threats} />
          </div>
        </div>
      </div>
    </div>
  );
}

