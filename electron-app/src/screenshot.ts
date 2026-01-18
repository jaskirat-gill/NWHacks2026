import { desktopCapturer, screen, NativeImage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  dpr: number;
}

// No padding - DOM sensor provides the full post bounds
const PADDING_TOP = 0;
const PADDING_BOTTOM = 0;
const PADDING_LEFT = 0;
const PADDING_RIGHT = 0;

export interface ScreenshotResult {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Capture the primary screen and crop to the specified region
 * @param region - The region to crop (in screen coordinates, CSS pixels)
 * @returns JPEG buffer of the cropped region
 */
export async function captureAndCrop(region: CropRegion): Promise<ScreenshotResult | null> {
  try {
    // Get primary display info
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor; // This is the actual DPR

    // Request a thumbnail at the full physical resolution
    const physicalWidth = screenWidth * scaleFactor;
    const physicalHeight = screenHeight * scaleFactor;

    // Get screen sources
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physicalWidth, height: physicalHeight },
    });

    if (sources.length === 0) {
      console.error('No screen sources found');
      return null;
    }

    // Use primary screen (first source)
    const primarySource = sources[0];
    const thumbnail: NativeImage = primarySource.thumbnail;

    if (thumbnail.isEmpty()) {
      console.error('Screenshot thumbnail is empty');
      return null;
    }

    // Get the actual thumbnail size
    const thumbSize = thumbnail.getSize();
    
    console.log(`[Screenshot] Screen: ${screenWidth}x${screenHeight}, scaleFactor: ${scaleFactor}`);
    console.log(`[Screenshot] Thumbnail: ${thumbSize.width}x${thumbSize.height}`);
    console.log(`[Screenshot] Region: x=${region.x}, y=${region.y}, w=${region.w}, h=${region.h}, dpr=${region.dpr}`);

    // Calculate the scale between thumbnail and physical screen
    // The thumbnail should be close to physical resolution, but might differ
    const thumbScaleX = thumbSize.width / physicalWidth;
    const thumbScaleY = thumbSize.height / physicalHeight;

    // Apply padding to capture more context (username, caption, etc.)
    const paddedX = region.x - PADDING_LEFT;
    const paddedY = region.y - PADDING_TOP;
    const paddedW = region.w + PADDING_LEFT + PADDING_RIGHT;
    const paddedH = region.h + PADDING_TOP + PADDING_BOTTOM;

    // Convert screen coordinates (CSS pixels) to thumbnail coordinates
    // region.x and region.y are already screen coordinates (include window.screenX/Y)
    // We need to convert to physical pixels and then to thumbnail pixels
    const cropX = Math.round(paddedX * scaleFactor * thumbScaleX);
    const cropY = Math.round(paddedY * scaleFactor * thumbScaleY);
    const cropW = Math.round(paddedW * scaleFactor * thumbScaleX);
    const cropH = Math.round(paddedH * scaleFactor * thumbScaleY);

    console.log(`[Screenshot] Crop coords: x=${cropX}, y=${cropY}, w=${cropW}, h=${cropH}`);

    // Clamp to valid bounds
    const clampedX = Math.max(0, Math.min(cropX, thumbSize.width - 1));
    const clampedY = Math.max(0, Math.min(cropY, thumbSize.height - 1));
    const clampedW = Math.min(cropW, thumbSize.width - clampedX);
    const clampedH = Math.min(cropH, thumbSize.height - clampedY);

    if (clampedW <= 0 || clampedH <= 0) {
      console.error('Invalid crop dimensions:', { clampedX, clampedY, clampedW, clampedH });
      return null;
    }

    console.log(`[Screenshot] Clamped coords: x=${clampedX}, y=${clampedY}, w=${clampedW}, h=${clampedH}`);

    // Crop the image
    const cropped = thumbnail.crop({
      x: clampedX,
      y: clampedY,
      width: clampedW,
      height: clampedH,
    });

    // Check if cropped image is valid
    if (cropped.isEmpty()) {
      console.error('[Screenshot] Cropped image is empty!');
      // Save full thumbnail for debugging
      const debugDir = path.join(process.cwd(), 'debug-screenshots');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      fs.writeFileSync(path.join(debugDir, `full_thumb_${Date.now()}.jpg`), thumbnail.toJPEG(85));
      console.log('[Screenshot] Saved full thumbnail for debugging');
      return null;
    }

    // Convert to JPEG buffer
    const jpegBuffer = cropped.toJPEG(85); // 85% quality
    console.log(`[Screenshot] JPEG buffer size: ${jpegBuffer.length} bytes`);

    return {
      buffer: jpegBuffer,
      width: clampedW,
      height: clampedH,
    };
  } catch (error) {
    console.error('Screenshot capture error:', error);
    return null;
  }
}

/**
 * Save a screenshot buffer to disk for debugging
 * @param buffer - JPEG buffer to save
 * @param filename - Optional filename (defaults to timestamp)
 */
export async function saveDebugScreenshot(buffer: Buffer, filename?: string): Promise<string | null> {
  try {
    // Create debug directory if it doesn't exist
    const debugDir = path.join(process.cwd(), 'debug-screenshots');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    // Generate filename
    const name = filename || `screenshot_${Date.now()}.jpg`;
    const filePath = path.join(debugDir, name);

    // Write file
    fs.writeFileSync(filePath, buffer);
    console.log('Debug screenshot saved:', filePath);

    return filePath;
  } catch (error) {
    console.error('Failed to save debug screenshot:', error);
    return null;
  }
}
