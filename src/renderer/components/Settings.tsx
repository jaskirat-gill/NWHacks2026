import React from 'react';

export default function Settings() {
  // In renderer process, we can't access process.env directly
  // This would need to be passed from main process via IPC
  // For MVP, we'll show a generic message
  const hasGeminiKey = true; // Placeholder - would check via IPC
  const hasSafeBrowsingKey = true; // Placeholder - would check via IPC

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-400 mb-2">API Configuration</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Gemini API</span>
              <span className={`px-2 py-1 rounded text-xs ${
                hasGeminiKey ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
              }`}>
                {hasGeminiKey ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Safe Browsing API</span>
              <span className={`px-2 py-1 rounded text-xs ${
                hasSafeBrowsingKey ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
              }`}>
                {hasSafeBrowsingKey ? 'Configured' : 'Not Configured'}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Configure API keys in your <code className="bg-gray-900 px-1 rounded">.env</code> file
          </p>
        </div>
      </div>
    </div>
  );
}

