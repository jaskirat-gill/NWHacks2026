import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MonitoringControl } from './components/MonitoringControl';
import { ThreatStats } from './components/ThreatStats';
import { ThreatLog } from './components/ThreatLog';
import { Settings } from './components/Settings';
import HistoryView from './components/HistoryView';
import { ThreatEntry } from './types';

declare global {
  interface Window {
    electronAPI: {
      toggleDetection: () => Promise<{ enabled: boolean }>;
      getDetectionState: () => Promise<{ enabled: boolean }>;
      getScreenshots: () => Promise<{ [postId: string]: string[] }>;
      onDetectionStateChanged: (callback: (state: { enabled: boolean }) => void) => void;
    };
  }
}

type Tab = 'control' | 'history';

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
  const [activeTab, setActiveTab] = useState<Tab>('control');
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [threats, setThreats] = useState<ThreatEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loadingThreats, setLoadingThreats] = useState(false);

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
  }, []);

  // Load threats from API based on screenshots
  useEffect(() => {
    loadThreats();
  }, []);

  const loadThreats = async () => {
    try {
      setLoadingThreats(true);
      
      // Get all screenshots grouped by post ID
      const screenshots = await window.electronAPI.getScreenshots();
      const postIds = Object.keys(screenshots);
      
      if (postIds.length === 0) {
        setThreats([]);
        setLoadingThreats(false);
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
      setLoadingThreats(false);
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

  const threatCounts = {
    high: threats.filter((t) => t.riskLevel === "HIGH").length,
    medium: threats.filter((t) => t.riskLevel === "MEDIUM").length,
    low: threats.filter((t) => t.riskLevel === "LOW").length,
  };

  return (
    <div className="h-full w-full bg-background text-foreground flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => setActiveTab('control')}
          className={`flex-1 px-6 py-4 text-lg font-semibold transition-colors ${
            activeTab === 'control'
              ? 'bg-primary/20 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
          }`}
        >
          Control Panel
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-6 py-4 text-lg font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-primary/20 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
          }`}
        >
          History
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'control' ? (
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
                      <ThreatLog threats={threats} />
                    )}
                  </div>
                </div>
              </main>
            </div>
          </div>
        ) : (
          <HistoryView />
        )}
      </div>
    </div>
  );
};

export default ControlApp;
