import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MonitoringControl } from './components/MonitoringControl';
import { ThreatStats } from './components/ThreatStats';
import { ThreatLog } from './components/ThreatLog';
import { Settings } from './components/Settings';
import { ThreatEntry, EducationData } from './types';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

interface DetectionResult {
  is_ai: boolean;
  confidence: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNCERTAIN';
  reasons: string[];
  risk_factors: Record<string, any>;
  classifier_scores?: Record<string, number>;
  plausible_intents?: Array<Record<string, any>>;
}

const ControlApp: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [threats, setThreats] = useState<ThreatEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loadingThreats, setLoadingThreats] = useState(false);

  // Screenshots directory for thumbnails
  const [screenshotsDir, setScreenshotsDir] = useState<string>('');

  // Education modal state - lifted to parent so it persists across ThreatLog re-renders
  const [showEducationModal, setShowEducationModal] = useState<boolean>(false);
  const [educationPostId, setEducationPostId] = useState<string | null>(null);
  const [educationData, setEducationData] = useState<EducationData | null>(null);
  const [educationLoading, setEducationLoading] = useState<boolean>(false);
  const [educationError, setEducationError] = useState<string | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);

  useEffect(() => {
    // Update current time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Get initial state
    window.electronAPI.getDetectionState().then((state) => {
      setIsMonitoring(state.enabled);
    });

    // Listen for state changes from main process
    window.electronAPI.onDetectionStateChanged((state) => {
      setIsMonitoring(state.enabled);
    });

    // Get screenshots directory for thumbnails
    window.electronAPI.getScreenshotsDir().then((dir) => {
      setScreenshotsDir(dir);
    });
  }, []);

  // Load threats from API based on screenshots - refresh every 5 seconds
  useEffect(() => {
    loadThreats(true); // Initial load shows loading state
    
    // Refresh threats periodically to catch new analyses (silent refresh)
    const refreshInterval = setInterval(() => {
      loadThreats(false); // Refresh doesn't show loading state to avoid unmounting ThreatLog
    }, 5000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  const loadThreats = async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setLoadingThreats(true);
      }
      
      // Get all screenshots grouped by post ID
      const screenshots = await window.electronAPI.getScreenshots();
      const postIds = Object.keys(screenshots);
      
      if (postIds.length === 0) {
        setThreats([]);
        if (showLoading) {
          setLoadingThreats(false);
        }
        return;
      }

      // Fetch analysis for each post ID
      const threatPromises = postIds.map(async (postId): Promise<ThreatEntry | null> => {
        try {
          const response = await fetch(`${API_BASE_URL}/analyze/${postId}`);
          
          if (!response.ok) {
            // If analysis doesn't exist yet (404), skip this post
            if (response.status === 404) {
              console.log(`Analysis not found for post ${postId}`);
              return null;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const analysis: DetectionResult = await response.json();
          
          // Convert DetectionResult to ThreatEntry
          const threatEntry: ThreatEntry = {
            id: parseInt(postId.replace('post_', '')) || Date.now(),
            postId: postId,  // Store the postId string for API calls
            timestamp: new Date().toISOString(), // You might want to extract from filename or API
            riskLevel: mapSeverityToRiskLevel(analysis),
            score: Math.round(analysis.confidence * 100),
            description: generateDescription(analysis),
            screenshot: screenshots[postId][0] || '', // Use first screenshot
            coordinates: { x: 0, y: 0 }, // Not available from API
            indicators: analysis.reasons || [],
            threatType: analysis.is_ai ? 'AI-Generated' : 'Human-Created',
            is_ai: analysis.is_ai,
          };
          
          return threatEntry;
        } catch (error) {
          console.error(`Error fetching analysis for ${postId}:`, error);
          return null;
        }
      });

      const threatResults = await Promise.all(threatPromises);
      const validThreats = threatResults.filter((t): t is ThreatEntry => t !== null);
      
      // Sort by post ID (most recent first)
      validThreats.sort((a, b) => b.id - a.id);
      
      setThreats(validThreats);
    } catch (error) {
      console.error('Error loading threats:', error);
    } finally {
      if (showLoading) {
        setLoadingThreats(false);
      }
    }
  };

  const mapSeverityToRiskLevel = (analysis: DetectionResult): "HIGH" | "MEDIUM" | "LOW" => {
    const confidence = analysis.confidence * 100;
    
    // is_ai=true, confidence > 80: likely AI → HIGH (red)
    if (analysis.is_ai && confidence > 80) {
      return 'HIGH';
    }
    
    // is_ai=true, confidence 60-80: possibly AI → MEDIUM (orange)
    if (analysis.is_ai && confidence >= 60 && confidence <= 80) {
      return 'MEDIUM';
    }
    
    // is_ai=false, confidence > 60: likely real → LOW (green)
    // confidence < 60: unclear → LOW (muted)
    // All other cases → LOW
    return 'LOW';
  };

  const generateDescription = (analysis: DetectionResult): string => {
    const confidence = Math.round(analysis.confidence * 100);
    
    if (analysis.is_ai) {
      if (confidence > 80) {
        return `Likely AI-generated content (${confidence}% confidence)`;
      } else if (confidence >= 60) {
        return `Possibly AI-generated content (${confidence}% confidence)`;
      } else {
        return `Unclear - may be AI-generated (${confidence}% confidence)`;
      }
    } else {
      if (confidence > 60) {
        return `Likely real content (${confidence}% confidence)`;
      } else {
        return `Unclear content classification (${confidence}% confidence)`;
      }
    }
  };

  const handleStartMonitoring = async () => {
    try {
      const result = await window.electronAPI.toggleDetection();
      setIsMonitoring(result.enabled);
    } catch (error) {
      console.error('Error starting monitoring:', error);
    }
  };

  const handleStopMonitoring = async () => {
    try {
      const result = await window.electronAPI.toggleDetection();
      setIsMonitoring(result.enabled);
    } catch (error) {
      console.error('Error stopping monitoring:', error);
    }
  };

  // Education modal handlers
  const handleGetEducated = async (postId: string) => {
    setEducationPostId(postId);
    setEducationLoading(true);
    setEducationError(null);
    setShowEducationModal(true);
    setCurrentFrameIndex(0);
    setEducationData(null);

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

  const threatCounts = {
    high: threats.filter((t) => t.riskLevel === "HIGH").length,
    medium: threats.filter((t) => t.riskLevel === "MEDIUM").length,
    low: threats.filter((t) => t.riskLevel === "LOW").length,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background grid effect */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10">
        <Header currentTime={currentTime} isMonitoring={isMonitoring} />

        <main className="container mx-auto px-4 py-6 space-y-6">
          {/* Top stats row */}
          <ThreatStats threatCounts={threatCounts} isMonitoring={isMonitoring} />

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left sidebar - Monitoring Control */}
            <div className="lg:col-span-3 space-y-6">
              <MonitoringControl
                isMonitoring={isMonitoring}
                onStart={handleStartMonitoring}
                onStop={handleStopMonitoring}
              />
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full px-4 py-3 bg-secondary/50 hover:bg-secondary border border-border rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between"
              >
                <span>Settings</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${showSettings ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSettings && <Settings />}
            </div>

            {/* Main content - Threat Log */}
            <div className="lg:col-span-9">
              {loadingThreats ? (
                <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-12 text-center">
                  <p className="text-muted-foreground">Loading threat analysis...</p>
                </div>
              ) : (
                <ThreatLog threats={threats} onGetEducated={handleGetEducated} screenshotsDir={screenshotsDir} />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Education Modal - rendered at parent level so it persists */}
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
    </div>
  );
};

export default ControlApp;
