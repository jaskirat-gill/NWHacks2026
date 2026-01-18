import React, { useState, useEffect } from 'react';
import { EducationData } from '../types';

interface BadgeProps {
  x: number;
  y: number;
  label: string;
  score: number;
  postId: string | null;
}

const Badge: React.FC<BadgeProps> = ({ x, y, label, score, postId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [isLoadingEducation, setIsLoadingEducation] = useState(false);
  const [educationData, setEducationData] = useState<EducationData | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [educationError, setEducationError] = useState<string | null>(null);

  // Reset states when postId changes (new post detected)
  useEffect(() => {
    setIsExpanded(false);
    setShowEducationModal(false);
    setEducationData(null);
    setCurrentFrameIndex(0);
    setEducationError(null);
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
    // Don't re-enable click-through if modal is open
    if (!showEducationModal) {
      window.electronAPI.setIgnoreMouseEvents(true);
    }
  };

  const handleClick = () => {
    if (label !== 'Analyzing...') {
      setIsExpanded(!isExpanded);
    }
  };

  const handleGetEducated = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!postId) return;
    
    setIsLoadingEducation(true);
    setEducationError(null);
    
    try {
      const data = await window.electronAPI.requestEducation(postId);
      setEducationData(data);
      setShowEducationModal(true);
      setCurrentFrameIndex(0);
    } catch (error: any) {
      console.error('Failed to get education:', error);
      setEducationError(error.message || 'Failed to load educational content');
    } finally {
      setIsLoadingEducation(false);
    }
  };

  const handleCloseModal = () => {
    setShowEducationModal(false);
    window.electronAPI.setIgnoreMouseEvents(true);
  };

  const handlePrevFrame = () => {
    if (educationData && currentFrameIndex > 0) {
      setCurrentFrameIndex(currentFrameIndex - 1);
    }
  };

  const handleNextFrame = () => {
    if (educationData && currentFrameIndex < educationData.frames.length - 1) {
      setCurrentFrameIndex(currentFrameIndex + 1);
    }
  };

  const colors = getStatusColor();
  const isAnalyzing = label === 'Analyzing...';

  return (
    <>
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

              {/* Error message */}
              {educationError && (
                <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded-lg">
                  {educationError}
                </div>
              )}

              {/* Get educated button */}
              <button
                onClick={handleGetEducated}
                disabled={isLoadingEducation}
                className={`
                  w-full py-2.5 px-4
                  bg-white/10 hover:bg-white/20
                  border border-white/10 hover:border-white/20
                  rounded-xl
                  text-white text-sm font-medium
                  transition-all duration-200
                  flex items-center justify-center gap-2
                  hover:scale-[1.02]
                  ${isLoadingEducation ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {isLoadingEducation ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Get Educated
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Education Modal */}
      {showEducationModal && educationData && (
        <div 
          className="fixed inset-0 z-[9999999] flex items-center justify-center"
          onMouseEnter={handleMouseEnter}
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          
          {/* Modal Content */}
          <div 
            className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors.bg }}
                />
                <h2 className="text-white font-semibold text-lg">
                  Understanding This Detection
                </h2>
              </div>
              <button 
                onClick={handleCloseModal}
                className="text-white/60 hover:text-white transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-6">
              {/* Frame Carousel */}
              {educationData.frames.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-white/70 text-sm font-medium">Video Frames</h3>
                  <div className="relative">
                    {/* Frame Image */}
                    <div className="aspect-video bg-black rounded-xl overflow-hidden">
                      <img 
                        src={`data:image/jpeg;base64,${educationData.frames[currentFrameIndex]}`}
                        alt={`Frame ${currentFrameIndex + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    
                    {/* Navigation */}
                    {educationData.frames.length > 1 && (
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 pointer-events-none">
                        <button
                          onClick={handlePrevFrame}
                          disabled={currentFrameIndex === 0}
                          className={`
                            pointer-events-auto
                            w-10 h-10 rounded-full bg-black/60 backdrop-blur
                            flex items-center justify-center
                            transition-all
                            ${currentFrameIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80'}
                          `}
                        >
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={handleNextFrame}
                          disabled={currentFrameIndex === educationData.frames.length - 1}
                          className={`
                            pointer-events-auto
                            w-10 h-10 rounded-full bg-black/60 backdrop-blur
                            flex items-center justify-center
                            transition-all
                            ${currentFrameIndex === educationData.frames.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80'}
                          `}
                        >
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}
                    
                    {/* Frame indicator */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-3 py-1 rounded-full">
                      <span className="text-white text-xs">
                        {currentFrameIndex + 1} / {educationData.frames.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Detection Summary */}
              <div className="bg-white/5 rounded-xl p-4 space-y-2">
                <h3 className="text-white/70 text-sm font-medium">Detection Summary</h3>
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-white/50 text-xs block">Classification</span>
                    <span className="text-white font-medium">
                      {educationData.detection_summary.is_ai ? 'AI-Generated' : 'Likely Authentic'}
                    </span>
                  </div>
                  <div className="bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-white/50 text-xs block">Confidence</span>
                    <span className="text-white font-medium">
                      {Math.round(educationData.detection_summary.confidence * 100)}%
                    </span>
                  </div>
                  <div className="bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-white/50 text-xs block">Severity</span>
                    <span className={`font-medium ${
                      educationData.detection_summary.severity === 'HIGH' ? 'text-red-400' :
                      educationData.detection_summary.severity === 'MEDIUM' ? 'text-orange-400' :
                      'text-green-400'
                    }`}>
                      {educationData.detection_summary.severity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Indicators */}
              {educationData.indicators.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-white/70 text-sm font-medium">Key Indicators</h3>
                  <div className="space-y-2">
                    {educationData.indicators.map((indicator, index) => (
                      <div 
                        key={index}
                        className="flex items-start gap-2 bg-white/5 rounded-lg p-3"
                      >
                        <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-white/80 text-sm">{indicator}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Educational Explanation */}
              <div className="space-y-3">
                <h3 className="text-white/70 text-sm font-medium">What You Should Know</h3>
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-white/10">
                  <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                    {educationData.explanation}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleCloseModal}
                className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Badge;
