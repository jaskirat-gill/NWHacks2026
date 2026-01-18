import React, { useState, useEffect } from 'react';
import Badge from './components/Badge';
import { OverlayState } from './types';

declare global {
  interface Window {
    electronAPI: {
      onOverlayUpdate: (callback: (state: OverlayState) => void) => void;
    };
  }
}

const App: React.FC = () => {
  const [overlayState, setOverlayState] = useState<OverlayState>({
    visible: false,
    x: 0,
    y: 0,
    label: '',
    score: 0,
    postId: null,
  });

  useEffect(() => {
    window.electronAPI.onOverlayUpdate((state) => {
      setOverlayState(state);
    });
  }, []);

  if (!overlayState.visible) {
    return null;
  }

  return (
    <Badge
      x={overlayState.x}
      y={overlayState.y}
      label={overlayState.label}
      score={overlayState.score}
    />
  );
};

export default App;
