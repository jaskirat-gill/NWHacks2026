import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      toggleDetection: () => Promise<{ enabled: boolean }>;
      getDetectionState: () => Promise<{ enabled: boolean }>;
      onDetectionStateChanged: (callback: (state: { enabled: boolean }) => void) => void;
    };
  }
}

const ControlPanel: React.FC = () => {
  const [detectionEnabled, setDetectionEnabled] = useState<boolean>(true);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  useEffect(() => {
    // Get initial state
    window.electronAPI.getDetectionState().then((state) => {
      setDetectionEnabled(state.enabled);
    });

    // Listen for state changes from main process
    window.electronAPI.onDetectionStateChanged((state) => {
      setDetectionEnabled(state.enabled);
    });
  }, []);

  const handleToggle = async () => {
    if (isToggling) return;
    
    setIsToggling(true);
    try {
      const result = await window.electronAPI.toggleDetection();
      setDetectionEnabled(result.enabled);
    } catch (error) {
      console.error('Error toggling detection:', error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-center p-8">
      {/* App Name */}
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-yellow-600 tracking-wide">
          Reality Check
        </h1>
      </div>

      {/* Power Button */}
      <button
        onClick={handleToggle}
        disabled={isToggling}
        className={`relative w-48 h-48 rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95 ${
          detectionEnabled
            ? 'bg-yellow-600 shadow-lg shadow-yellow-600/50 hover:shadow-yellow-600/70'
            : 'bg-gray-700 shadow-lg shadow-gray-900/50 hover:bg-gray-600'
        } ${isToggling ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/* Power Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className={`w-20 h-20 ${
              detectionEnabled ? 'text-black' : 'text-gray-400'
            } transition-colors duration-300`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            {/* Power symbol: circle with vertical line */}
            <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.59-5.41L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z" />
          </svg>
        </div>

        {/* Ripple effect when enabled */}
        {detectionEnabled && (
          <div className="absolute inset-0 rounded-full bg-yellow-600 opacity-30 animate-ping" />
        )}
      </button>

      {/* Status Text */}
      <div className="mt-12 text-center">
        <p
          className={`text-2xl font-semibold transition-colors duration-300 ${
            detectionEnabled ? 'text-yellow-600' : 'text-gray-500'
          }`}
        >
          {detectionEnabled ? 'Detection Active' : 'Detection Disabled'}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {detectionEnabled
            ? 'Monitoring and analyzing content'
            : 'Click to enable detection'}
        </p>
      </div>
    </div>
  );
};

export default ControlPanel;

