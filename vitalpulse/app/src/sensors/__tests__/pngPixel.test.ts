import { deflateSync } from 'zlib';
import { decodePng, averageRedChannel } from '../pngPixel';

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunk(type: string, data: number[]): number[] {
  const typeBytes = Array.from(type).map((c) => c.charCodeAt(0));
  // CRC is not validated by our decoder, so zeros are fine here.
  return [...u32(data.length), ...typeBytes, ...data, 0, 0, 0, 0];
}

/** Builds a minimal, valid (8-bit, non-interlaced, colorType RGB) PNG from raw RGB pixel rows. */
function buildRgbPng(width: number, height: number, pixels: number[][]): Buffer {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdrData = [...u32(width), ...u32(height), 8, 2, 0, 0, 0];

  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixels[y * width + x];
      raw.push(r, g, b);
    }
  }
  const compressed = deflateSync(Buffer.from(raw));

  const bytes = [
    ...signature,
    ...chunk('IHDR', ihdrData),
    ...chunk('IDAT', Array.from(compressed)),
    ...chunk('IEND', []),
  ];
  return Buffer.from(bytes);
}

describe('decodePng', () => {
  it('decodes a solid red 2x1 PNG', () => {
    const png = buildRgbPng(2, 1, [
      [255, 0, 0],
      [255, 0, 0],
    ]);
    const image = decodePng(png.toString('base64'));
    expect(image.width).toBe(2);
    expect(image.height).toBe(1);
    expect(Array.from(image.pixels)).toEqual([255, 0, 0, 255, 255, 0, 0, 255]);
  });

  it('decodes mixed pixels and computes the average red channel', () => {
    const png = buildRgbPng(2, 1, [
      [200, 10, 10],
      [100, 10, 10],
    ]);
    const image = decodePng(png.toString('base64'));
    expect(averageRedChannel(image)).toBe(150);
  });

  it('rejects data that is not a PNG', () => {
    const notPng = Buffer.from('hello world').toString('base64');
    expect(() => decodePng(notPng)).toThrow('Not a PNG file');
  });
});
