import React from 'react';

interface BadgeProps {
  x: number;
  y: number;
  label: string;
  score: number;
}

const Badge: React.FC<BadgeProps> = ({ x, y, label, score }) => {
  const getBadgeColors = () => {
    if (label === 'Analyzing...') return 'bg-gray-500/90';
    if (label === 'Likely AI') return 'bg-red-500/90';
    if (label === 'Unclear') return 'bg-amber-500/90';
    return 'bg-green-500/90';
  };

  return (
    <div
      className={`
        fixed px-3 py-2 rounded-lg text-white font-semibold text-sm
        backdrop-blur-md shadow-lg z-[999999] pointer-events-none
        transition-all duration-200 ease-out
        ${getBadgeColors()}
      `}
      style={{
        left: x,
        top: y,
      }}
    >
      <span className="block">{label}</span>
      {label !== 'Analyzing...' && (
        <span className="block text-xs opacity-90 mt-0.5">
          {Math.round(score * 100)}% confidence
        </span>
      )}
    </div>
  );
};

export default Badge;
