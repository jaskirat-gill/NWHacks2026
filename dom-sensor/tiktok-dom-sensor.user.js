// ==UserScript==
// @name         TikTok AI Detector - DOM Sensor
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Detects active TikTok post and sends bounding box to Electron overlay
// @author       NWHacks2026
// @match        https://www.tiktok.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ============ CONFIG ============
  const WS_URL = 'ws://localhost:8765';
  const THROTTLE_MS = 250; // max 4 updates/sec
  const MIN_IMG_SIZE = 200; // ignore images smaller than 200x200
  const MIN_POST_SIZE = 300; // post container must be at least 300x300
  const MIN_VISIBILITY = 0.60; // prefer posts with >= 60% visibility
  const RECONNECT_DELAY_MS = 2000;
  const DEBUG = true;

  // ============ STATE ============
  let ws = null;
  let isConnected = false;
  let lastSendTime = 0;
  let pendingUpdate = null;
  let postContainers = new Map(); // element -> { id, visibility }
  let activePostId = null;
  let postIdCounter = 0;

  // ============ LOGGING ============
  function log(...args) {
    if (DEBUG) console.log('[TikTok AI Detector]', ...args);
  }

  function warn(...args) {
    if (DEBUG) console.warn('[TikTok AI Detector]', ...args);
  }

  // ============ WEBSOCKET ============
  function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    log('Connecting to WebSocket...', WS_URL);
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      isConnected = true;
      log('WebSocket connected');
    };

    ws.onclose = () => {
      isConnected = false;
      log('WebSocket disconnected, reconnecting in', RECONNECT_DELAY_MS, 'ms');
      setTimeout(connectWebSocket, RECONNECT_DELAY_MS);
    };

    ws.onerror = (err) => {
      warn('WebSocket error:', err);
    };
  }

  function sendMessage(data) {
    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch (err) {
      warn('Failed to send message:', err);
      return false;
    }
  }

  // ============ POST DETECTION ============
  
  // Check if element is a valid media element (video or large image)
  function isValidMedia(el) {
    if (el.tagName === 'VIDEO') {
      return true;
    }
    
    if (el.tagName === 'IMG') {
      const rect = el.getBoundingClientRect();
      return rect.width >= MIN_IMG_SIZE && rect.height >= MIN_IMG_SIZE;
    }
    
    return false;
  }

  // Find the post container ancestor for a media element
  // We want a container that includes: video + engagement buttons + username/caption
  function findPostContainer(mediaEl) {
    let el = mediaEl.parentElement;
    let bestContainer = null;
    
    // Target width: we want a container that's at least 50% of viewport width
    // This ensures we capture the video + sidebar buttons
    const targetMinWidth = window.innerWidth * 0.50;
    
    while (el && el !== document.body) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      
      // Skip fixed position elements
      if (style.position === 'fixed') {
        el = el.parentElement;
        continue;
      }
      
      // Check if this is a valid post container (large enough)
      if (rect.width >= MIN_POST_SIZE && rect.height >= MIN_POST_SIZE) {
        // Should contain the media element
        const mediaRect = mediaEl.getBoundingClientRect();
        const containsMedia = (
          rect.left <= mediaRect.left &&
          rect.right >= mediaRect.right &&
          rect.top <= mediaRect.top &&
          rect.bottom >= mediaRect.bottom
        );
        
        if (containsMedia) {
          bestContainer = el;
          
          // If we found a container wide enough, use it
          // Otherwise keep going up to find a wider one
          if (rect.width >= targetMinWidth) {
            log('Found wide container:', rect.width, 'x', rect.height, 'target was', targetMinWidth);
            return el;
          }
        }
      }
      
      el = el.parentElement;
    }
    
    // Return the best container we found (even if narrower than target)
    if (bestContainer) {
      const rect = bestContainer.getBoundingClientRect();
      log('Using best container found:', rect.width, 'x', rect.height);
    }
    return bestContainer;
  }

  // Generate unique ID for a post container
  function getPostId(container) {
    if (!container.dataset.aiDetectorId) {
      container.dataset.aiDetectorId = `post_${++postIdCounter}_${Date.now()}`;
    }
    return container.dataset.aiDetectorId;
  }

  // ============ INTERSECTION OBSERVER ============
  
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const container = entry.target;
        const id = getPostId(container);
        
        if (entry.isIntersecting) {
          postContainers.set(container, {
            id,
            visibility: entry.intersectionRatio,
          });
        } else {
          postContainers.delete(container);
        }
      }
      
      // Schedule update
      scheduleUpdate();
    },
    {
      threshold: [0, 0.25, 0.5, 0.6, 0.75, 1.0],
    }
  );

  // ============ MUTATION OBSERVER ============
  
  function scanForMedia(root = document.body) {
    // Find all video elements
    const videos = root.querySelectorAll('video');
    for (const video of videos) {
      processMediaElement(video);
    }
    
    // Find all large images
    const images = root.querySelectorAll('img');
    for (const img of images) {
      if (isValidMedia(img)) {
        processMediaElement(img);
      }
    }
  }

  function processMediaElement(mediaEl) {
    const container = findPostContainer(mediaEl);
    if (!container) return;
    
    // Skip if already being observed
    if (container.dataset.aiDetectorObserved) return;
    container.dataset.aiDetectorObserved = 'true';
    
    log('Found post container:', getPostId(container));
    intersectionObserver.observe(container);
  }

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        
        // Check if the node itself is media
        if (node.tagName === 'VIDEO' || node.tagName === 'IMG') {
          if (isValidMedia(node)) {
            processMediaElement(node);
          }
        }
        
        // Scan children
        scanForMedia(node);
      }
    }
  });

  // ============ ACTIVE POST SELECTION ============
  
  function getViewportCenter() {
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
  }

  function getDistanceToCenter(rect) {
    const center = getViewportCenter();
    const elementCenterX = rect.left + rect.width / 2;
    const elementCenterY = rect.top + rect.height / 2;
    
    return Math.sqrt(
      Math.pow(elementCenterX - center.x, 2) +
      Math.pow(elementCenterY - center.y, 2)
    );
  }

  function selectActivePost() {
    let bestPost = null;
    let bestScore = -1;
    
    for (const [container, data] of postContainers.entries()) {
      const rect = container.getBoundingClientRect();
      
      // Skip if not visible enough
      if (data.visibility < 0.1) continue;
      
      // Score based on visibility (prefer >= MIN_VISIBILITY)
      let score = data.visibility;
      if (data.visibility >= MIN_VISIBILITY) {
        score += 1; // Bonus for high visibility
      }
      
      // Tie-breaker: distance to center (closer is better)
      const distance = getDistanceToCenter(rect);
      const normalizedDistance = distance / Math.max(window.innerWidth, window.innerHeight);
      score -= normalizedDistance * 0.5; // Subtract penalty for distance
      
      if (score > bestScore) {
        bestScore = score;
        bestPost = { container, data, rect };
      }
    }
    
    return bestPost;
  }

  // ============ UPDATE SCHEDULING ============
  
  function scheduleUpdate() {
    const now = Date.now();
    const timeSinceLastSend = now - lastSendTime;
    
    if (timeSinceLastSend >= THROTTLE_MS) {
      // Can send immediately
      sendUpdate();
    } else {
      // Schedule for later
      if (!pendingUpdate) {
        pendingUpdate = setTimeout(() => {
          pendingUpdate = null;
          sendUpdate();
        }, THROTTLE_MS - timeSinceLastSend);
      }
    }
  }

  function sendUpdate() {
    lastSendTime = Date.now();
    
    const activePost = selectActivePost();
    
    const message = {
      site: 'tiktok',
      dpr: window.devicePixelRatio || 1,
      windowScreenX: window.screenX,
      windowScreenY: window.screenY,
      post: null,
    };
    
    if (activePost) {
      const { container, data, rect } = activePost;
      
      // Try to find the actual media content element within the container
      // Priority: DivMediaCardOverlay (perfect bounds) > video > img
      let contentRect = null;
      
      // Safety padding to ensure we don't cut off edges
      const PADDING = 20;
      
      // Look for TikTok's DivMediaCardOverlay which has perfect bounds
      // TikTok uses class names like "css-xxx--DivMediaCardOverlay"
      let mediaOverlay = container.querySelector('[class*="DivMediaCardOverlay"]');
      
      // If not found with querySelector, try finding it manually
      if (!mediaOverlay) {
        const allDivs = container.querySelectorAll('div');
        for (const div of allDivs) {
          if (div.className && div.className.includes && div.className.includes('MediaCard')) {
            mediaOverlay = div;
            log('Found MediaCard element via manual search');
            break;
          }
        }
      }
      const video = container.querySelector('video');
      const img = container.querySelector('img[src*="tiktok"]');
      
      if (mediaOverlay) {
        const overlayRect = mediaOverlay.getBoundingClientRect();
        if (overlayRect.width >= MIN_IMG_SIZE && overlayRect.height >= MIN_IMG_SIZE) {
          contentRect = overlayRect;
          log('Using DivMediaCardOverlay bounds:', overlayRect.width, 'x', overlayRect.height);
        }
      }
      
      if (!contentRect && video) {
        const videoRect = video.getBoundingClientRect();
        if (videoRect.width >= MIN_IMG_SIZE && videoRect.height >= MIN_IMG_SIZE) {
          contentRect = videoRect;
          log('Using video bounds:', videoRect.width, 'x', videoRect.height);
        }
      }
      
      if (!contentRect && img) {
        const imgRect = img.getBoundingClientRect();
        if (imgRect.width >= MIN_IMG_SIZE && imgRect.height >= MIN_IMG_SIZE) {
          contentRect = imgRect;
          log('Using image bounds:', imgRect.width, 'x', imgRect.height);
        }
      }
      
      // Fall back to container rect if nothing found
      if (!contentRect) {
        contentRect = rect;
        log('Using container bounds (fallback)');
      }
      
      // Apply offset correction for capture alignment
      const LEFT_OFFSET = 76;  // Shift capture region left
      const TOP_CROP = 30;     // Crop this many pixels from the top
      
      contentRect = {
        left: contentRect.left - LEFT_OFFSET,
        top: contentRect.top + TOP_CROP,
        width: contentRect.width,
        height: contentRect.height - TOP_CROP,  // Reduce height to keep bottom in place
      };
      
      // Convert to screen coordinates
      const screenX = contentRect.left + window.screenX;
      const screenY = contentRect.top + window.screenY;
      
      message.post = {
        id: data.id,
        x: screenX,
        y: screenY,
        w: contentRect.width,
        h: contentRect.height,
        visibility: data.visibility,
      };
      
      if (data.id !== activePostId) {
        activePostId = data.id;
        log('Active post changed:', data.id, 'visibility:', data.visibility.toFixed(2));
      }
    } else {
      if (activePostId !== null) {
        activePostId = null;
        log('No active post');
      }
    }
    
    sendMessage(message);
  }

  // ============ SCROLL LISTENER ============
  
  // Also update on scroll for smoother tracking
  let scrollTimeout = null;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      scheduleUpdate();
    }, 50);
  }, { passive: true });

  // ============ INIT ============
  
  function init() {
    log('Initializing DOM sensor...');
    
    // Connect to WebSocket
    connectWebSocket();
    
    // Start observing DOM changes
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    // Initial scan
    scanForMedia();
    
    log('DOM sensor ready');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
