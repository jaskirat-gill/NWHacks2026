import React, { useState, useEffect } from 'react';
import { Grid3x3, X, ChevronDown } from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getScreenshots: () => Promise<{ [postId: string]: string[] }>;
      getScreenshotsDir: () => Promise<string>;
    };
  }
}

interface PostReel {
  postId: string;
  images: string[];
}

const HistoryView: React.FC = () => {
  const [postReels, setPostReels] = useState<PostReel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [screenshotsDir, setScreenshotsDir] = useState<string>('');

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
          images: images.sort(), // Sort images within each post
        }))
        .sort((a, b) => {
          // Sort by post ID number if possible
          const aNum = parseInt(a.postId.replace('post_', ''));
          const bNum = parseInt(b.postId.replace('post_', ''));
          return bNum - aNum; // Most recent first
        });
      
      setPostReels(reels);
    } catch (error) {
      console.error('Error loading screenshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImagePath = (filename: string): string => {
    if (!screenshotsDir) {
      return '';
    }
    // Use file:// protocol with absolute path
    // Convert backslashes to forward slashes
    let normalizedPath = screenshotsDir.replace(/\\/g, '/');
    // For Windows paths (e.g., C:/path), file:// needs three slashes: file:///C:/path
    // For Unix paths (e.g., /path), file:// needs three slashes: file:///path
    if (normalizedPath.match(/^[A-Z]:/)) {
      // Windows path: file:///C:/path/file
      return `file:///${normalizedPath}/${filename}`;
    } else {
      // Unix path: file:///path/file
      return `file://${normalizedPath}/${filename}`;
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-background flex items-center justify-center relative">
        {/* Background grid effect */}
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
        {/* Background grid effect */}
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
    <div className="h-full w-full bg-background overflow-y-auto relative">
      {/* Background grid effect */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Ambient glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto py-6 px-4">
        {postReels.map((reel, index) => {
          const mainImage = reel.images[0];
          const hasMultipleFrames = reel.images.length > 1;
          const isExpanded = expandedPost === reel.postId;

          return (
            <div
              key={reel.postId}
              className="mb-6 group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Post Card */}
              <div className="bg-card/80 backdrop-blur-md rounded-xl overflow-hidden border-2 border-border hover:border-primary/30 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
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
                  
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Multiple frames indicator */}
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
  );
};

export default HistoryView;
