import React, { useState } from 'react';

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

interface ThreatLogProps {
  threats: ThreatEntry[];
}

export default function ThreatLog({ threats }: ThreatLogProps) {
  const [selectedThreat, setSelectedThreat] = useState<ThreatEntry | null>(null);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'bg-red-900/50 border-red-700';
      case 'MEDIUM':
        return 'bg-yellow-900/50 border-yellow-700';
      case 'LOW':
        return 'bg-green-900/50 border-green-700';
      default:
        return 'bg-gray-800 border-gray-700';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Threat Log</h2>
      
      {threats.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>No threats detected yet.</p>
          <p className="text-sm mt-2">Start monitoring to begin threat detection.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {threats.map((threat) => (
            <div
              key={threat.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-700 ${getRiskColor(threat.riskLevel)}`}
              onClick={() => setSelectedThreat(threat)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      threat.riskLevel === 'HIGH' ? 'bg-red-600 text-white' :
                      threat.riskLevel === 'MEDIUM' ? 'bg-yellow-500 text-black' :
                      'bg-green-500 text-white'
                    }`}>
                      {threat.riskLevel}
                    </span>
                    <span className="text-xs text-gray-400">Score: {threat.score}/100</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-1">{threat.description}</p>
                  <p className="text-xs text-gray-500">{formatTimestamp(threat.timestamp)}</p>
                  {threat.indicators.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">Indicators:</p>
                      <div className="flex flex-wrap gap-1">
                        {threat.indicators.map((indicator, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                          >
                            {indicator}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Threat Detail Modal */}
      {selectedThreat && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedThreat(null)}
        >
          <div
            className="bg-gray-800 rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-semibold">Threat Details</h3>
              <button
                onClick={() => setSelectedThreat(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Risk Level</p>
                <p className={`inline-block px-3 py-1 rounded font-semibold ${
                  selectedThreat.riskLevel === 'HIGH' ? 'bg-red-600 text-white' :
                  selectedThreat.riskLevel === 'MEDIUM' ? 'bg-yellow-500 text-black' :
                  'bg-green-500 text-white'
                }`}>
                  {selectedThreat.riskLevel}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-400">Description</p>
                <p className="text-white">{selectedThreat.description}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-400">Timestamp</p>
                <p className="text-white">{formatTimestamp(selectedThreat.timestamp)}</p>
              </div>
              
              {selectedThreat.indicators.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Threat Indicators</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedThreat.indicators.map((indicator, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-300"
                      >
                        {indicator}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedThreat.screenshot && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Screenshot</p>
                  <img
                    src={selectedThreat.screenshot}
                    alt="Threat screenshot"
                    className="max-w-full rounded border border-gray-700"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

