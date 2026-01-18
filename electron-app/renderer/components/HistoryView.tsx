import React, { useState, useEffect } from 'react';

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
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
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
      <div className="h-full w-full bg-black flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading history...</p>
      </div>
    );
  }

  if (postReels.length === 0) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <p className="text-gray-400 text-lg">No screenshots found</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {postReels.map((reel) => (
          <div
            key={reel.postId}
            className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-yellow-600/30 transition-colors"
          >
            {/* Post Header */}
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-yellow-600 font-semibold text-lg">{reel.postId}</h3>
              <p className="text-gray-400 text-sm mt-1">
                {reel.images.length} frame{reel.images.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Image Gallery */}
            <div className="p-4">
              {selectedPost === reel.postId ? (
                // Expanded view - show all images in grid
                <div className="grid grid-cols-3 gap-3">
                  {reel.images.map((image, idx) => (
                    <div
                      key={idx}
                      className="aspect-square bg-gray-800 rounded overflow-hidden group cursor-pointer hover:ring-2 hover:ring-yellow-600 transition-all"
                    >
                      <img
                        src={getImagePath(image)}
                        alt={`${reel.postId} frame ${idx}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                // Collapsed view - show first few images
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {reel.images.slice(0, 5).map((image, idx) => (
                    <div
                      key={idx}
                      className="flex-shrink-0 w-24 h-24 bg-gray-800 rounded overflow-hidden"
                    >
                      <img
                        src={getImagePath(image)}
                        alt={`${reel.postId} frame ${idx}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                  {reel.images.length > 5 && (
                    <button
                      onClick={() => setSelectedPost(reel.postId)}
                      className="flex-shrink-0 w-24 h-24 bg-gray-800 rounded flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-yellow-600 transition-colors"
                    >
                      <span className="text-xs font-semibold">
                        +{reel.images.length - 5}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Toggle Button */}
              <button
                onClick={() => setSelectedPost(selectedPost === reel.postId ? null : reel.postId)}
                className="mt-3 w-full py-2 text-sm text-yellow-600 hover:text-yellow-500 hover:bg-yellow-600/10 rounded transition-colors"
              >
                {selectedPost === reel.postId ? 'Show Less' : 'Show All'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;

