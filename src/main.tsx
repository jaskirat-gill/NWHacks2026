import React from 'react';
import ReactDOM from 'react-dom/client';
import './renderer/styles/index.css';
import ControlPanel from './renderer/ControlPanel';
import Overlay from './renderer/Overlay';

// Check if we're in overlay mode
const urlParams = new URLSearchParams(window.location.search);
const isOverlay = urlParams.get('overlay') === 'true';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);

// Add error boundary
try {
  if (isOverlay) {
    root.render(
      <React.StrictMode>
        <Overlay />
      </React.StrictMode>
    );
  } else {
    root.render(
      <React.StrictMode>
        <ControlPanel />
      </React.StrictMode>
    );
  }
} catch (error) {
  console.error('Error rendering app:', error);
  root.render(
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Error Loading Application</h1>
      <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      <p>Check the console for more details.</p>
    </div>
  );
}

