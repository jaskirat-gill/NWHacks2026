import * as fs from 'fs';
import * as path from 'path';

// Dynamically resolve screenshots directory relative to this file
// From electron-app/src/ -> go up to NWHacks2026/ -> screenshots/
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', '..', 'screenshots');
// Use 127.0.0.1 explicitly to avoid IPv6 resolution issues on Linux
const API_BASE_URL = 'http://127.0.0.1:8000';

// Track processed files to avoid duplicates
const processedFiles = new Set<string>();

// Debounce timeout for file events
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 500; // Wait 500ms after last file event before processing

// File watcher instance
let watcher: fs.FSWatcher | null = null;

/**
 * Extract post ID from filename (filename minus extension)
 */
function extractPostId(fileName: string): string {
  // Remove .jpg or .jpeg extension (case insensitive)
  return fileName.replace(/\.(jpg|jpeg)$/i, '');
}

/**
 * Send image file to the analyze API endpoint
 */
async function sendImageToAPI(filePath: string, postId: string): Promise<void> {
  try {
    // Read the file
    const fileBuffer = await fs.promises.readFile(filePath);
    const fileName = path.basename(filePath);

    // Build API URL with post ID
    const apiUrl = `${API_BASE_URL}/analyze/${postId}`;

    // Create FormData-like payload using manual multipart/form-data construction
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const formDataParts: Buffer[] = [];

    // Add file field
    formDataParts.push(Buffer.from(`--${boundary}\r\n`));
    formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
    formDataParts.push(Buffer.from(`Content-Type: image/jpeg\r\n\r\n`));
    formDataParts.push(fileBuffer);
    formDataParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(formDataParts);

    // Send POST request
    // Note: Content-Type header includes boundary as required for multipart/form-data
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
    console.log(`[FileWatcher] Successfully sent ${fileName} to API with post ID ${postId}. Response:`, result);
  } catch (error: any) {
    // Check if it's a connection error
    if (error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED') {
      console.warn(`[FileWatcher] API server not available at ${API_BASE_URL}. Is the classifier server running?`);
      console.warn(`[FileWatcher] To start the API server, run: cd classifier && python main.py`);
    } else {
      console.error(`[FileWatcher] Error sending ${filePath} to API:`, error);
    }
    // Don't throw - continue watching even if API call fails
  }
}

/**
 * Process a new .jpg file
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

  // Extract post ID from filename (filename minus extension)
  const postId = extractPostId(fileName);

  // Send to API
  console.log(`[FileWatcher] Processing new file: ${fileName} with post ID: ${postId}`);
  await sendImageToAPI(filePath, postId);
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
}

