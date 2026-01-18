import React from 'react';

interface DebugBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DebugBox: React.FC<DebugBoxProps> = ({ x, y, w, h }) => {
  return (
    <div
      className="fixed pointer-events-none z-[999998]"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        border: '3px solid #00ff00',
        borderRadius: '8px',
        backgroundColor: 'rgba(0, 255, 0, 0.05)',
        boxShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
      }}
    >
      {/* Corner markers */}
      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-green-400" />
      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-green-400" />
      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-green-400" />
      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-green-400" />
      
      {/* Coordinates label */}
      <div 
        className="absolute -top-7 left-0 px-2 py-0.5 bg-green-500 text-white text-xs font-mono rounded"
      >
        {Math.round(x)}, {Math.round(y)} • {Math.round(w)}×{Math.round(h)}
      </div>
    </div>
  );
};

export default DebugBox;
