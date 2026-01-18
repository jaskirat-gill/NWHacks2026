import React, { useState } from 'react';
import ControlPanel from './components/ControlPanel';
import HistoryView from './components/HistoryView';

declare global {
  interface Window {
    electronAPI: {
      toggleDetection: () => Promise<{ enabled: boolean }>;
      getDetectionState: () => Promise<{ enabled: boolean }>;
      getScreenshots: () => Promise<{ [postId: string]: string[] }>;
      onDetectionStateChanged: (callback: (state: { enabled: boolean }) => void) => void;
    };
  }
}

type Tab = 'control' | 'history';

const ControlApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('control');

  return (
    <div className="h-full w-full bg-black text-white flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b border-yellow-600/30">
        <button
          onClick={() => setActiveTab('control')}
          className={`flex-1 px-6 py-4 text-lg font-semibold transition-colors ${
            activeTab === 'control'
              ? 'bg-yellow-600/20 text-yellow-600 border-b-2 border-yellow-600'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
          }`}
        >
          Control Panel
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-6 py-4 text-lg font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-yellow-600/20 text-yellow-600 border-b-2 border-yellow-600'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
          }`}
        >
          History
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'control' ? <ControlPanel /> : <HistoryView />}
      </div>
    </div>
  );
};

export default ControlApp;

