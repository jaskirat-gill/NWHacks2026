import React, { useState, useEffect } from 'react';
import Badge from './components/Badge';
import DebugBox from './components/DebugBox';
import { OverlayState } from './types';

declare global {
  interface Window {
    electronAPI: {
      onOverlayUpdate: (callback: (state: OverlayState) => void) => void;
      setIgnoreMouseEvents: (ignore: boolean) => void;
    };
  }
}

const App: React.FC = () => {
  const [overlayState, setOverlayState] = useState<OverlayState>({
    visible: false,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    label: '',
    score: 0,
    postId: null,
    showDebugBox: false,
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
    <>
      {overlayState.showDebugBox && (
        <DebugBox
          x={overlayState.x}
          y={overlayState.y}
          w={overlayState.w}
          h={overlayState.h}
        />
      )}
      <Badge
        x={overlayState.x + overlayState.w + 12}
        y={overlayState.y + 60}
        label={overlayState.label}
        score={overlayState.score}
        postId={overlayState.postId}
      />
    </>
  );
};

export default App;
