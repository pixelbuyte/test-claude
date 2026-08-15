/**
 * Deterministic pseudo-random numbers.
 *
 * The simulation must never call Math.random - a single unseeded draw would
 * silently invalidate every recorded best time. Every random decision in the
 * game draws from one of these seeded streams instead, and `purity.test.js`
 * enforces the rule by scanning source.
 *
 * Each consumer gets its own named stream, so adding an extra AI opponent
 * cannot shift the level layout that was generated from the same seed.
 */

/** FNV-1a. Maps a stream name to a 32-bit value. */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mixes a 32-bit integer so nearby seeds produce unrelated streams. */
export function mix32(x) {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * sfc32 - small, fast, and statistically solid for gameplay purposes.
 * Returns a function producing floats in [0, 1).
 */
export function sfc32(a, b, c, d) {
  let s0 = a >>> 0, s1 = b >>> 0, s2 = c >>> 0, s3 = d >>> 0;
  return function next() {
    s0 >>>= 0; s1 >>>= 0; s2 >>>= 0; s3 >>>= 0;
    let t = (s0 + s1) >>> 0;
    s0 = s1 ^ (s1 >>> 9);
    s1 = (s2 + (s2 << 3)) >>> 0;
    s2 = (s2 << 21) | (s2 >>> 11);
    s3 = (s3 + 1) >>> 0;
    t = (t + s3) >>> 0;
    s2 = (s2 + t) >>> 0;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * A named, independent random stream.
 *
 * `new Rng(seed, 'layout')` and `new Rng(seed, 'ai:vex')` never interfere, so
 * systems can be added or removed without perturbing each other's sequences.
 */
export class Rng {
  constructor(seed, streamName = '') {
    const s = mix32((seed >>> 0) ^ hashString(streamName));
    this._next = sfc32(mix32(s + 0x9e3779b9), mix32(s + 0x85ebca6b),
      mix32(s + 0xc2b2ae35), mix32(s + 0x27d4eb2f));
    // Discard a short warm-up so the first draw is well mixed.
    for (let i = 0; i < 12; i++) this._next();
  }

  /** Float in [0, 1). */
  float() {
    return this._next();
  }

  /** Float in [min, max). */
  range(min, max) {
    return min + this._next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min, max) {
    return min + Math.floor(this._next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p) {
    return this._next() < p;
  }

  /** Uniform element of an array. */
  pick(arr) {
    return arr[Math.floor(this._next() * arr.length)];
  }

  /**
   * Weighted pick. `weights[i]` is the relative weight of `items[i]`.
   * Returns the index, or -1 when every weight is zero.
   */
  pickWeightedIndex(weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    if (total <= 0) return -1;
    let r = this._next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}
