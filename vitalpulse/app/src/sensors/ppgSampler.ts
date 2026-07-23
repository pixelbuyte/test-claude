import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { CameraView } from 'expo-camera';
import { averageRedChannel, decodePng } from './pngPixel';
import { analyzePulseSamples, PulseAnalysisResult, RawSample } from './pulseAnalysis';

/**
 * expo-camera has no live pixel-frame API (only still photos, video files, and
 * barcode scanning), so this samples brightness by repeatedly taking a tiny,
 * unprocessed photo and shrinking it to an 8x8 image — small enough that the
 * OS's own image resizer effectively does the pixel averaging for us. The
 * achievable rate (typically 3-8 samples/sec on-device) is a real hardware
 * limit, which is exactly why capture runs for `durationMs` and why the
 * analysis pipeline reports a signal-quality grade instead of pretending every
 * reading is equally trustworthy.
 */
export interface PpgCaptureOptions {
  durationMs?: number;
  onProgress?: (elapsedMs: number, durationMs: number) => void;
  onSample?: (sample: RawSample) => void;
  isCancelled?: () => boolean;
}

export async function capturePulse(
  cameraRef: React.RefObject<CameraView | null>,
  options: PpgCaptureOptions = {}
): Promise<PulseAnalysisResult> {
  const durationMs = options.durationMs ?? 20000;
  const start = Date.now();
  const samples: RawSample[] = [];

  while (Date.now() - start < durationMs) {
    if (options.isCancelled?.()) break;
    const elapsed = Date.now() - start;
    options.onProgress?.(elapsed, durationMs);

    try {
      const camera = cameraRef.current;
      if (!camera) break;
      const photo = await camera.takePictureAsync({ quality: 0, skipProcessing: true });
      if (!photo?.uri) continue;
      const shrunk = await manipulateAsync(photo.uri, [{ resize: { width: 8, height: 8 } }], {
        base64: true,
        format: SaveFormat.PNG,
      });
      if (!shrunk.base64) continue;
      const image = decodePng(shrunk.base64);
      const value = averageRedChannel(image);
      const sample: RawSample = { t: Date.now() - start, value };
      samples.push(sample);
      options.onSample?.(sample);
    } catch {
      // A single dropped frame shouldn't abort the whole reading — the
      // analysis pipeline already tolerates missing/irregular samples.
    }
  }

  return analyzePulseSamples(samples);
}
