import React, { useState, useEffect } from 'react';

interface BadgeProps {
  x: number;
  y: number;
  label: string;
  score: number;
  postId: string | null;
}

const Badge: React.FC<BadgeProps> = ({ x, y, label, score, postId }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset expanded state when postId changes (new post detected)
  useEffect(() => {
    setIsExpanded(false);
  }, [postId]);

  const getStatusColor = () => {
    if (label === 'Analyzing...') return { bg: '#6B7280', glow: 'rgba(107, 114, 128, 0.5)' };
    if (label === 'Likely AI') return { bg: '#EF4444', glow: 'rgba(239, 68, 68, 0.5)' };      // Red - high confidence AI
    if (label === 'Possibly AI') return { bg: '#F97316', glow: 'rgba(249, 115, 22, 0.5)' };  // Orange - medium confidence AI
    if (label === 'Unclear') return { bg: '#EAB308', glow: 'rgba(234, 179, 8, 0.5)' };       // Yellow - low confidence
    return { bg: '#22C55E', glow: 'rgba(34, 197, 94, 0.5)' };                                 // Green - likely real
  };

  const handleMouseEnter = () => {
    window.electronAPI.setIgnoreMouseEvents(false);
  };

  const handleMouseLeave = () => {
    window.electronAPI.setIgnoreMouseEvents(true);
  };

  const handleClick = () => {
    if (label !== 'Analyzing...') {
      setIsExpanded(!isExpanded);
    }
  };

  const handleGetEducated = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Navigate to education page for:', label, score);
  };

  const colors = getStatusColor();
  const isAnalyzing = label === 'Analyzing...';

  return (
    <div
      className="fixed z-[999999]"
      style={{ left: x, top: y }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Attention-grabbing outer glow ring */}
      {!isAnalyzing && !isExpanded && (
        <div 
          className="absolute -inset-1 rounded-2xl animate-pulse"
          style={{ 
            background: `linear-gradient(135deg, ${colors.glow}, transparent)`,
            filter: 'blur(8px)',
          }}
        />
      )}

      {/* Main card */}
      <div
        onClick={handleClick}
        className={`
          relative
          bg-black/90 backdrop-blur-xl rounded-2xl
          border border-white/20
          shadow-2xl
          transition-all duration-300 ease-out
          ${!isAnalyzing ? 'cursor-pointer hover:scale-105 hover:border-white/40' : ''}
        `}
        style={{ 
          padding: isExpanded ? '16px' : '12px 16px',
          minWidth: isExpanded ? '180px' : 'auto',
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)`,
        }}
      >
        {/* Main label row */}
        <div className="flex items-center gap-3">
          {/* Glowing status dot */}
          <div className="relative flex-shrink-0">
            <div 
              className={`w-3 h-3 rounded-full ${isAnalyzing ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: colors.bg }}
            />
            <div 
              className="absolute inset-0 rounded-full animate-ping"
              style={{ backgroundColor: colors.bg, opacity: 0.4 }}
            />
          </div>
          
          <span className="text-white text-base font-semibold whitespace-nowrap">
            {label}
          </span>

          {/* Chevron indicator when not expanded */}
          {!isAnalyzing && (
            <svg 
              className={`w-4 h-4 text-white/60 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>

        {/* Tap hint when collapsed */}
        {!isExpanded && !isAnalyzing && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[11px] text-white/40 font-medium">Tap for details</span>
          </div>
        )}

        {/* Expanded content */}
        {isExpanded && !isAnalyzing && (
          <div className="mt-4 space-y-4">
            {/* Divider */}
            <div className="h-px bg-white/10" />
            
            {/* Confidence */}
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Confidence</span>
              <span className="text-white font-bold text-lg">
                {Math.round(score * 100)}%
              </span>
            </div>

            {/* Get educated button */}
            <button
              onClick={handleGetEducated}
              className="
                w-full py-2.5 px-4
                bg-white/10 hover:bg-white/20
                border border-white/10 hover:border-white/20
                rounded-xl
                text-white text-sm font-medium
                transition-all duration-200
                flex items-center justify-center gap-2
                hover:scale-[1.02]
              "
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Get Educated
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Badge;
