import React, { useState, useEffect } from 'react';
import { Grid3x3, X, AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { EducationData } from '../types';

const API_BASE_URL = 'http://localhost:8000';

// Detection result from the API
interface DetectionResult {
  is_ai: boolean;
  confidence: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNCERTAIN';
  reasons: string[];
  risk_factors: Record<string, any>;
  classifier_scores?: Record<string, number>;
}

interface PostReel {
  postId: string;
  images: string[];
  detection: DetectionResult | null;
  detectionLoading: boolean;
}

const HistoryView: React.FC = () => {
  const [postReels, setPostReels] = useState<PostReel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [screenshotsDir, setScreenshotsDir] = useState<string>('');
  
  // Education modal state
  const [showEducationModal, setShowEducationModal] = useState<boolean>(false);
  const [educationPostId, setEducationPostId] = useState<string | null>(null);
  const [educationData, setEducationData] = useState<EducationData | null>(null);
  const [educationLoading, setEducationLoading] = useState<boolean>(false);
  const [educationError, setEducationError] = useState<string | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);

  useEffect(() => {
    loadScreenshots();
    window.electronAPI.getScreenshotsDir().then((dir) => {
      setScreenshotsDir(dir);
    });
  }, []);

  const loadScreenshots = async () => {
    try {
      setLoading(true);
      const grouped = await window.electronAPI.getScreenshots();
      
      const reels: PostReel[] = Object.entries(grouped)
        .map(([postId, images]) => ({
          postId,
          images: images.sort(),
          detection: null,
          detectionLoading: true,
        }))
        .sort((a, b) => {
          const aNum = parseInt(a.postId.replace('post_', ''));
          const bNum = parseInt(b.postId.replace('post_', ''));
          return bNum - aNum;
        });
      
      setPostReels(reels);
      
      // Fetch detection results for each post
      fetchDetectionResults(reels);
    } catch (error) {
      console.error('Error loading screenshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetectionResults = async (reels: PostReel[]) => {
    for (const reel of reels) {
      try {
        const response = await fetch(`${API_BASE_URL}/analyze/${reel.postId}`);
        
        if (response.ok) {
          const detection: DetectionResult = await response.json();
          setPostReels(prev => prev.map(r => 
            r.postId === reel.postId 
              ? { ...r, detection, detectionLoading: false }
              : r
          ));
        } else {
          // Analysis not found (404) or other error
          setPostReels(prev => prev.map(r => 
            r.postId === reel.postId 
              ? { ...r, detectionLoading: false }
              : r
          ));
        }
      } catch (error) {
        console.error(`Error fetching detection for ${reel.postId}:`, error);
        setPostReels(prev => prev.map(r => 
          r.postId === reel.postId 
            ? { ...r, detectionLoading: false }
            : r
        ));
      }
    }
  };

  const getDetectionStyles = (detection: DetectionResult | null, isLoading: boolean) => {
    if (isLoading) {
      return {
        icon: Loader2,
        bg: 'bg-muted/50',
        border: 'border-border',
        text: 'text-muted-foreground',
        badge: 'bg-muted/50 text-muted-foreground',
        label: 'Analyzing...',
        iconClass: 'animate-spin',
      };
    }
    
    if (!detection) {
      return {
        icon: Info,
        bg: 'bg-muted/30',
        border: 'border-border/50',
        text: 'text-muted-foreground',
        badge: 'bg-muted/30 text-muted-foreground',
        label: 'Not Analyzed',
        iconClass: '',
      };
    }

    const confidence = detection.confidence * 100;
    const is_ai = detection.is_ai;

    // is_ai=true, confidence > 80: likely AI (red)
    if (is_ai && confidence > 80) {
      return {
        icon: AlertTriangle,
        bg: 'bg-destructive/10',
        border: 'border-destructive/30',
        text: 'text-destructive',
        badge: 'bg-destructive/20 text-destructive',
        label: 'Likely AI',
        iconClass: '',
      };
    }

    // is_ai=true, confidence 60-80: possibly AI (orange)
    if (is_ai && confidence >= 60 && confidence <= 80) {
      return {
        icon: AlertCircle,
        bg: 'bg-warning/10',
        border: 'border-warning/30',
        text: 'text-warning',
        badge: 'bg-warning/20 text-warning',
        label: 'Possibly AI',
        iconClass: '',
      };
    }

    // is_ai=false, confidence > 60: likely real (green)
    if (!is_ai && confidence > 60) {
      return {
        icon: Info,
        bg: 'bg-success/10',
        border: 'border-success/30',
        text: 'text-success',
        badge: 'bg-success/20 text-success',
        label: 'Likely Real',
        iconClass: '',
      };
    }

    // confidence < 60: unclear
    return {
      icon: Info,
      bg: 'bg-muted/10',
      border: 'border-border/30',
      text: 'text-muted-foreground',
      badge: 'bg-muted/20 text-muted-foreground',
      label: 'Unclear',
      iconClass: '',
    };
  };

  const handleGetEducated = async (postId: string) => {
    setEducationPostId(postId);
    setEducationLoading(true);
    setEducationError(null);
    setShowEducationModal(true);
    setCurrentFrameIndex(0);

    try {
      const data = await window.electronAPI.requestEducation(postId);
      setEducationData(data);
    } catch (error: any) {
      console.error('Failed to get education:', error);
      setEducationError(error.message || 'Failed to load educational content');
    } finally {
      setEducationLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowEducationModal(false);
    setEducationData(null);
    setEducationPostId(null);
    setEducationError(null);
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

  const getImagePath = (filename: string): string => {
    if (!screenshotsDir) {
      return '';
    }
    let normalizedPath = screenshotsDir.replace(/\\/g, '/');
    if (normalizedPath.match(/^[A-Z]:/)) {
      return `file:///${normalizedPath}/${filename}`;
    } else {
      return `file://${normalizedPath}/${filename}`;
    }
  };

  const getModalColors = () => {
    if (!educationData) {
      return { bg: '#6B7280' };
    }
    const { is_ai, confidence } = educationData.detection_summary;
    if (is_ai && confidence * 100 > 80) return { bg: '#EF4444' };
    if (is_ai && confidence * 100 >= 60) return { bg: '#F97316' };
    if (!is_ai && confidence * 100 > 60) return { bg: '#22C55E' };
    return { bg: '#6B7280' };
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-background flex items-center justify-center relative">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
            <Grid3x3 className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground text-lg">Loading history...</p>
        </div>
      </div>
    );
  }

  if (postReels.length === 0) {
    return (
      <div className="h-full w-full bg-background flex items-center justify-center relative">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary border border-border flex items-center justify-center">
            <Grid3x3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-lg">No content found</p>
          <p className="text-sm text-muted-foreground/70 mt-2">Analyzed content will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full w-full bg-background overflow-y-auto relative">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto py-6 px-4">
          {postReels.map((reel, index) => {
            const mainImage = reel.images[0];
            const hasMultipleFrames = reel.images.length > 1;
            const isExpanded = expandedPost === reel.postId;
            const styles = getDetectionStyles(reel.detection, reel.detectionLoading);

            return (
              <div
                key={reel.postId}
                className="mb-6 group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="bg-card/80 backdrop-blur-md rounded-xl overflow-hidden border-2 border-border hover:border-primary/30 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
                  {/* Detection Status Badge - Top of card */}
                  <div className={`px-4 py-3 ${styles.bg} border-b ${styles.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${styles.bg} border ${styles.border}`}>
                        <styles.icon className={`w-4 h-4 ${styles.text} ${styles.iconClass}`} />
                      </div>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles.badge}`}>
                          {styles.label}
                        </span>
                        {reel.detection && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {Math.round(reel.detection.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Get Educated Button */}
                    {reel.detection && (
                      <button
                        onClick={() => handleGetEducated(reel.postId)}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/30 rounded-lg text-xs font-medium text-primary transition-all duration-200 flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Get Educated
                      </button>
                    )}
                  </div>

                  {/* Main Post Image */}
                  <div className="relative w-full bg-secondary/30 aspect-[9/16] overflow-hidden border-b border-border/50">
                    {mainImage && (
                      <img
                        src={getImagePath(mainImage)}
                        alt="Post content"
                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {hasMultipleFrames && !isExpanded && (
                      <button
                        onClick={() => setExpandedPost(expandedPost === reel.postId ? null : reel.postId)}
                        className="absolute bottom-4 right-4 px-4 py-2 bg-background/90 backdrop-blur-md border border-border rounded-full text-xs font-medium text-foreground hover:bg-background hover:scale-105 transition-all duration-200 flex items-center gap-2 shadow-lg"
                      >
                        <Grid3x3 className="w-3.5 h-3.5" />
                        <span>{reel.images.length}</span>
                      </button>
                    )}
                  </div>

                  {/* Detection Reasons */}
                  {reel.detection && reel.detection.reasons && reel.detection.reasons.length > 0 && (
                    <div className="px-4 py-3 bg-secondary/10 border-t border-border/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Indicators</p>
                      <div className="flex flex-wrap gap-1.5">
                        {reel.detection.reasons.slice(0, 3).map((reason, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-secondary/50 rounded text-xs text-foreground/80"
                          >
                            {reason}
                          </span>
                        ))}
                        {reel.detection.reasons.length > 3 && (
                          <span className="px-2 py-1 text-xs text-muted-foreground">
                            +{reel.detection.reasons.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expanded Frames View */}
                  {isExpanded && hasMultipleFrames && (
                    <div className="p-5 bg-secondary/20 border-t-2 border-border animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-primary/10">
                            <Grid3x3 className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            {reel.images.length} frame{reel.images.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => setExpandedPost(null)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
                          aria-label="Collapse frames"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {reel.images.map((image, idx) => (
                          <div
                            key={idx}
                            className="group/frame aspect-square bg-secondary/30 rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-200 hover:scale-105 cursor-pointer relative"
                          >
                            <img
                              src={getImagePath(image)}
                              alt={`Frame ${idx + 1}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover/frame:scale-110"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-0 group-hover/frame:opacity-100 transition-opacity duration-200" />
                            <div className="absolute bottom-1.5 left-1.5 right-1.5">
                              <div className="text-[10px] font-medium text-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded opacity-0 group-hover/frame:opacity-100 transition-opacity duration-200 text-center">
                                Frame {idx + 1}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Education Modal */}
      {showEducationModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          
          {/* Modal Content */}
          <div 
            className="relative bg-card/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getModalColors().bg }}
                />
                <h2 className="text-foreground font-semibold text-lg">
                  Understanding This Detection
                </h2>
              </div>
              <button 
                onClick={handleCloseModal}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-6">
              {educationLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground">Loading educational content...</p>
                </div>
              ) : educationError ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                  </div>
                  <p className="text-destructive font-medium mb-2">Failed to load content</p>
                  <p className="text-sm text-muted-foreground">{educationError}</p>
                </div>
              ) : educationData ? (
                <>
                  {/* Frame Carousel */}
                  {educationData.frames.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-muted-foreground text-sm font-medium">Video Frames</h3>
                      <div className="relative">
                        <div className="aspect-video bg-black rounded-xl overflow-hidden">
                          <img 
                            src={`data:image/jpeg;base64,${educationData.frames[currentFrameIndex]}`}
                            alt={`Frame ${currentFrameIndex + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        
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
                        
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-3 py-1 rounded-full">
                          <span className="text-white text-xs">
                            {currentFrameIndex + 1} / {educationData.frames.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detection Summary */}
                  <div className="bg-secondary/30 rounded-xl p-4 space-y-2">
                    <h3 className="text-muted-foreground text-sm font-medium">Detection Summary</h3>
                    <div className="flex flex-wrap gap-3">
                      <div className="bg-secondary/50 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground text-xs block">Classification</span>
                        <span className="text-foreground font-medium">
                          {educationData.detection_summary.is_ai ? 'AI-Generated' : 'Likely Authentic'}
                        </span>
                      </div>
                      <div className="bg-secondary/50 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground text-xs block">Confidence</span>
                        <span className="text-foreground font-medium">
                          {Math.round(educationData.detection_summary.confidence * 100)}%
                        </span>
                      </div>
                      <div className="bg-secondary/50 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground text-xs block">Severity</span>
                        <span className={`font-medium ${
                          educationData.detection_summary.severity === 'HIGH' ? 'text-destructive' :
                          educationData.detection_summary.severity === 'MEDIUM' ? 'text-warning' :
                          'text-success'
                        }`}>
                          {educationData.detection_summary.severity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Key Indicators */}
                  {educationData.indicators.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-muted-foreground text-sm font-medium">Key Indicators</h3>
                      <div className="space-y-2">
                        {educationData.indicators.map((indicator, index) => (
                          <div 
                            key={index}
                            className="flex items-start gap-2 bg-secondary/20 rounded-lg p-3"
                          >
                            <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-foreground/80 text-sm">{indicator}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Educational Explanation */}
                  <div className="space-y-3">
                    <h3 className="text-muted-foreground text-sm font-medium">What You Should Know</h3>
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/10">
                      <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                        {educationData.explanation}
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <button
                onClick={handleCloseModal}
                className="w-full py-3 px-4 bg-secondary hover:bg-secondary/80 rounded-xl text-foreground font-medium transition-all"
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

export default HistoryView;
