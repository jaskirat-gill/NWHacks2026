import * as fs from 'fs';
import * as path from 'path';

// Dynamically resolve screenshots directory relative to this file
// From electron-app/src/ -> go up to NWHacks2026/ -> screenshots/
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', '..', 'screenshots');
// Use 127.0.0.1 explicitly to avoid IPv6 resolution issues on Linux
const API_BASE_URL = 'http://127.0.0.1:8000';

// Track processed files to avoid duplicates
const processedFiles = new Set<string>();

// Track posts that have already been sent to the API (to avoid re-analyzing)
const sentPostIds = new Set<string>();

// Debounce timeout for file events
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 100; // Just enough to catch duplicate events (was 500ms)

// Batch queue: group files by postId, accumulate up to BATCH_SIZE files per post
interface QueuedFile {
  fileName: string;
  filePath: string;
  postId: string;
  timestamp: number;
}

const fileQueue = new Map<string, QueuedFile[]>(); // postId -> list of queued files
const BATCH_SIZE = 1;

// File watcher instance
let watcher: fs.FSWatcher | null = null;

/**
 * Extract base post ID from filename (just "post_X" part)
 * Filename format: post_{X}_{timestamp}_frame{N}_{timestamp}.jpg
 * We want just "post_X" to use as the analysis key
 * Multiple batches for the same post will overwrite each other
 */
function extractPostId(fileName: string): string {
  // Remove extension first
  const withoutExt = fileName.replace(/\.(jpg|jpeg)$/i, '');
  
  // Extract just "post_X" - match the pattern "post_" followed by digits
  // e.g., "post_1_1768711195270_frame0_1768711199555" -> "post_1"
  const postIdMatch = withoutExt.match(/^(post_\d+)/);
  if (postIdMatch) {
    return postIdMatch[1];
  }
  
  // Fallback: try to extract anything before first underscore after "post_"
  const postIndex = withoutExt.indexOf('post_');
  if (postIndex !== -1) {
    const afterPost = withoutExt.substring(postIndex);
    const secondUnderscore = afterPost.indexOf('_', 5); // Skip "post_" (5 chars)
    if (secondUnderscore !== -1) {
      return afterPost.substring(0, secondUnderscore);
    }
    // If no second underscore, return everything after "post_"
    return afterPost;
  }
  
  // Final fallback: return without extension
  return withoutExt;
}

/**
 * Send batch of image files to the analyze API endpoint
 */
async function sendImageBatchToAPI(filePaths: string[], postId: string): Promise<void> {
  try {
    if (filePaths.length !== BATCH_SIZE) {
      console.warn(`[FileWatcher] Expected ${BATCH_SIZE} files, got ${filePaths.length}. Skipping batch.`);
      return;
    }

    // Build API URL with post ID
    const apiUrl = `${API_BASE_URL}/analyze/${postId}`;

    // Create FormData-like payload using manual multipart/form-data construction
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const formDataParts: Buffer[] = [];

    // Add all files (API expects "files" field with multiple files)
    for (const filePath of filePaths) {
      const fileBuffer = await fs.promises.readFile(filePath);
      const fileName = path.basename(filePath);

      formDataParts.push(Buffer.from(`--${boundary}\r\n`));
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="files"; filename="${fileName}"\r\n`));
      formDataParts.push(Buffer.from(`Content-Type: image/jpeg\r\n\r\n`));
      formDataParts.push(fileBuffer);
      formDataParts.push(Buffer.from(`\r\n`));
    }
    formDataParts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(formDataParts);

    // Send POST request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json();
    const fileNames = filePaths.map(p => path.basename(p)).join(', ');
    console.log(`[FileWatcher] Successfully sent batch of ${filePaths.length} files (${fileNames}) to API with post ID ${postId}. Response:`, result);
  } catch (error: any) {
    // Check if it's a connection error
    if (error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED') {
      console.warn(`[FileWatcher] API server not available at ${API_BASE_URL}. Is the classifier server running?`);
      console.warn(`[FileWatcher] To start the API server, run: cd classifier && python main.py`);
    } else {
      const fileNames = filePaths.map(p => path.basename(p)).join(', ');
      console.error(`[FileWatcher] Error sending batch (${fileNames}) to API:`, error);
    }
    // Don't throw - continue watching even if API call fails
  }
}

/**
 * Process a new .jpg file - add to queue and send batch when we have BATCH_SIZE files for a post
 * Only sends ONE batch per post ID to avoid redundant processing.
 */
async function processNewFile(fileName: string): Promise<void> {
  // Only process .jpg files
  if (!fileName.toLowerCase().endsWith('.jpg') && !fileName.toLowerCase().endsWith('.jpeg')) {
    return;
  }

  const filePath = path.join(SCREENSHOTS_DIR, fileName);

  // Check if file has already been processed
  if (processedFiles.has(fileName)) {
    return;
  }

  // Check if file actually exists (might be a false event)
  try {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      return;
    }
  } catch (error) {
    // File doesn't exist yet or was deleted, skip
    return;
  }

  // Mark as processed
  processedFiles.add(fileName);

  // Extract post ID from filename
  const postId = extractPostId(fileName);

  // Skip if we already sent a batch for this post (avoid re-analyzing)
  if (sentPostIds.has(postId)) {
    return;
  }

  // Add to queue
  if (!fileQueue.has(postId)) {
    fileQueue.set(postId, []);
  }

  const queue = fileQueue.get(postId)!;
  queue.push({
    fileName,
    filePath,
    postId,
    timestamp: Date.now(),
  });

  console.log(`[FileWatcher] Queued file: ${fileName} with post ID: ${postId} (queue size: ${queue.length}/${BATCH_SIZE})`);

  // If we have enough files for this post, send the batch
  if (queue.length === BATCH_SIZE) {
    const batchFiles = queue.splice(0, BATCH_SIZE); // Remove from queue
    const filePaths = batchFiles.map(f => f.filePath);
    
    // Mark this post as sent so we don't re-analyze it
    sentPostIds.add(postId);
    
    console.log(`[FileWatcher] Batch complete! Sending ${BATCH_SIZE} files for post ID: ${postId}`);
    await sendImageBatchToAPI(filePaths, postId);
  }
}

/**
 * Handle file system events with debouncing
 */
function handleFileEvent(eventType: string, fileName: string): void {
  // Only process 'rename' events (file creation/rename) and ignore directories
  if (eventType !== 'rename' || !fileName) {
    return;
  }

  // Clear existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Set new debounce timer
  debounceTimer = setTimeout(() => {
    processNewFile(fileName).catch((error) => {
      console.error(`[FileWatcher] Error processing file ${fileName}:`, error);
    });
  }, DEBOUNCE_MS);
}

/**
 * Start watching the screenshots directory
 */
export function startFileWatcher(): void {
  // Ensure directory exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    console.log(`[FileWatcher] Created screenshots directory: ${SCREENSHOTS_DIR}`);
  }

  // Check if watcher is already running
  if (watcher) {
    console.log('[FileWatcher] Watcher is already running');
    return;
  }

  try {
    // Start watching the directory
    watcher = fs.watch(SCREENSHOTS_DIR, (eventType, fileName) => {
      if (fileName) {
        handleFileEvent(eventType, fileName);
      }
    });

    console.log(`[FileWatcher] Started watching directory: ${SCREENSHOTS_DIR}`);
  } catch (error) {
    console.error('[FileWatcher] Error starting file watcher:', error);
  }
}

/**
 * Stop watching the screenshots directory
 */
export function stopFileWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (watcher) {
    watcher.close();
    watcher = null;
    console.log('[FileWatcher] Stopped watching directory');
  }

  // Clear all state
  fileQueue.clear();
  sentPostIds.clear();
  processedFiles.clear();
}

