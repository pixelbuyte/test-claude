const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const CODE: Record<string, number> = {};
for (let i = 0; i < CHARS.length; i++) CODE[CHARS[i]] = i;

/** Small, dependency-free base64 -> bytes decoder (works the same on iOS, Android, web, and in Jest). */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const byteLength = Math.floor((clean.length * 6) / 8);
  const out = new Uint8Array(byteLength);
  let bitBuffer = 0;
  let bitCount = 0;
  let outIndex = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = CODE[clean[i]];
    if (code === undefined) continue;
    bitBuffer = (bitBuffer << 6) | code;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      out[outIndex++] = (bitBuffer >> bitCount) & 0xff;
    }
  }
  return out;
}
