import React, { useState, useEffect } from 'react';
import ThreatBadge from './components/ThreatBadge';

interface OverlayData {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  coordinates: { x: number; y: number };
  id: number;
}

interface BadgeState extends OverlayData {
  timestamp: number;
}

export default function Overlay() {
  const [badges, setBadges] = useState<BadgeState[]>([]);

  useEffect(() => {
    const handleUpdate = (data: OverlayData) => {
      setBadges(prev => [
        ...prev,
        {
          ...data,
          timestamp: Date.now(),
        },
      ]);

      // Remove badge after 10 seconds
      setTimeout(() => {
        setBadges(prev => prev.filter(b => b.id !== data.id));
      }, 10000);
    };

    // Listen for overlay updates via IPC
    window.electronAPI.onOverlayUpdate(handleUpdate);

    return () => {
      window.electronAPI.removeAllListeners('overlay-update');
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {badges.map((badge) => (
        <ThreatBadge
          key={badge.id}
          riskLevel={badge.riskLevel}
          position={badge.coordinates}
        />
      ))}
    </div>
  );
}

