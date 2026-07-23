import { unzlibSync } from 'fflate';
import { base64ToBytes } from './base64';

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA, one byte per channel, row-major, top-to-bottom. */
  pixels: Uint8Array;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CHANNELS_BY_COLOR_TYPE: Record<number, number> = {
  0: 1, // grayscale
  2: 3, // RGB
  3: 1, // palette (unsupported below, we throw)
  4: 2, // grayscale + alpha
  6: 4, // RGBA
};

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Minimal PNG decoder for the narrow case this app needs: 8-bit-depth,
 * non-interlaced PNGs produced by expo-image-manipulator. Not a general
 * purpose decoder (no palette, no 16-bit, no interlacing).
 */
export function decodePng(base64: string): DecodedImage {
  const bytes = base64ToBytes(base64);
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error('Not a PNG file');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset < bytes.length) {
    const length =
      (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;

    if (type === 'IHDR') {
      const v = bytes;
      width = (v[dataStart] << 24) | (v[dataStart + 1] << 16) | (v[dataStart + 2] << 8) | v[dataStart + 3];
      height =
        (v[dataStart + 4] << 24) | (v[dataStart + 5] << 16) | (v[dataStart + 6] << 8) | v[dataStart + 7];
      bitDepth = v[dataStart + 8];
      colorType = v[dataStart + 9];
      interlace = v[dataStart + 12];
    } else if (type === 'IDAT') {
      idatChunks.push(bytes.subarray(dataStart, dataStart + length));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataStart + length + 4; // skip CRC
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  if (interlace !== 0) throw new Error('Interlaced PNG not supported');
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!channels) throw new Error(`Unsupported PNG color type: ${colorType}`);

  const total = idatChunks.reduce((sum, c) => sum + c.length, 0);
  const compressed = new Uint8Array(total);
  let pos = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, pos);
    pos += chunk.length;
  }
  const raw = unzlibSync(compressed);

  const bytesPerPixel = channels; // bitDepth 8 => 1 byte per channel
  const stride = width * bytesPerPixel;
  const pixels = new Uint8Array(width * height * 4);
  let prevRow = new Uint8Array(stride);
  let rawOffset = 0;

  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset++];
    const row = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    const outRow = new Uint8Array(stride);

    for (let x = 0; x < stride; x++) {
      const rawByte = row[x];
      const a = x >= bytesPerPixel ? outRow[x - bytesPerPixel] : 0;
      const b = prevRow[x];
      const c = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;
      let value: number;
      switch (filterType) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + a;
          break;
        case 2:
          value = rawByte + b;
          break;
        case 3:
          value = rawByte + Math.floor((a + b) / 2);
          break;
        case 4:
          value = rawByte + paeth(a, b, c);
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }
      outRow[x] = value & 0xff;
    }

    for (let x = 0; x < width; x++) {
      const srcIdx = x * bytesPerPixel;
      const dstIdx = (y * width + x) * 4;
      if (channels === 4) {
        pixels[dstIdx] = outRow[srcIdx];
        pixels[dstIdx + 1] = outRow[srcIdx + 1];
        pixels[dstIdx + 2] = outRow[srcIdx + 2];
        pixels[dstIdx + 3] = outRow[srcIdx + 3];
      } else if (channels === 3) {
        pixels[dstIdx] = outRow[srcIdx];
        pixels[dstIdx + 1] = outRow[srcIdx + 1];
        pixels[dstIdx + 2] = outRow[srcIdx + 2];
        pixels[dstIdx + 3] = 255;
      } else if (channels === 2) {
        pixels[dstIdx] = pixels[dstIdx + 1] = pixels[dstIdx + 2] = outRow[srcIdx];
        pixels[dstIdx + 3] = outRow[srcIdx + 1];
      } else {
        pixels[dstIdx] = pixels[dstIdx + 1] = pixels[dstIdx + 2] = outRow[srcIdx];
        pixels[dstIdx + 3] = 255;
      }
    }

    prevRow = outRow;
  }

  return { width, height, pixels };
}

/** Average red-channel intensity (0-255) — the channel with the strongest PPG pulsatile signal. */
export function averageRedChannel(image: DecodedImage): number {
  let sum = 0;
  const pixelCount = image.width * image.height;
  for (let i = 0; i < pixelCount; i++) {
    sum += image.pixels[i * 4];
  }
  return sum / pixelCount;
}
