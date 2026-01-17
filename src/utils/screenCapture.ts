import { desktopCapturer, nativeImage } from 'electron';

/**
 * Capture screen and convert to base64 image
 * @returns Base64 encoded PNG image or null if capture fails
 */
export async function captureScreen(): Promise<string | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (sources.length === 0) {
      console.error('No screen sources available');
      return null;
    }

    // Use the primary display
    const source = sources[0];
    const thumbnail = source.thumbnail;

    // Convert nativeImage to base64
    const pngBuffer = thumbnail.toPNG();
    const base64 = pngBuffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Screen capture error:', error);
    return null;
  }
}

