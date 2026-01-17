import React from 'react';

interface ThreatBadgeProps {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  position: { x: number; y: number };
}

export default function ThreatBadge({ riskLevel, position }: ThreatBadgeProps) {
  const getBadgeStyles = () => {
    const baseStyles = 'absolute pointer-events-auto px-4 py-2 rounded-lg font-semibold text-sm shadow-lg animate-pulse';
    
    switch (riskLevel) {
      case 'HIGH':
        return `${baseStyles} bg-red-600 text-white border-2 border-red-800`;
      case 'MEDIUM':
        return `${baseStyles} bg-yellow-500 text-black border-2 border-yellow-700`;
      case 'LOW':
        return `${baseStyles} bg-green-500 text-white border-2 border-green-700`;
      default:
        return baseStyles;
    }
  };

  const getEmoji = () => {
    switch (riskLevel) {
      case 'HIGH':
        return '🔴';
      case 'MEDIUM':
        return '🟡';
      case 'LOW':
        return '🟢';
      default:
        return '⚪';
    }
  };

  return (
    <div
      className={getBadgeStyles()}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <span className="mr-2">{getEmoji()}</span>
      <span>{riskLevel} RISK</span>
    </div>
  );
}

