/**
 * Z-bucketed CSR broadphase.
 *
 * A course is roughly 700 m long, 10 m wide and 20 m tall - overwhelmingly a 1-D
 * problem. Bucketing on Z alone gives the same rejection power as a full 3-D
 * grid for a fraction of the memory and none of the cell bookkeeping.
 *
 * Queries write into a caller-owned scratch buffer and dedupe multi-bucket
 * colliders with a monotonic stamp, so a query in the hot path allocates
 * nothing at all - no Set, no array, no closure.
 */
import { LEVEL } from '../../config.js';

export class Broadphase {
  constructor(bucketSize = LEVEL.bucketSize) {
    this.bucketSize = bucketSize;
    this.originZ = 0;
    this.bucketCount = 0;
    this.bucketStart = new Int32Array(1);
    this.bucketItems = new Int32Array(0);
    this.visitStamp = 0;
    this.cs = null;
    /** Counts queries that filled the output buffer - asserted zero in tests. */
    this.overflowCount = 0;
  }

  /** Counting-sorts every collider into its Z buckets. O(n) with no allocation churn. */
  build(colliderSet) {
    const cs = colliderSet;
    this.cs = cs;

    const bounds = { lo: 0, hi: 0 };
    cs.boundsZ(bounds);
    this.originZ = bounds.lo - this.bucketSize;
    const span = Math.max(bounds.hi - this.originZ, this.bucketSize);
    this.bucketCount = Math.ceil(span / this.bucketSize) + 2;

    const counts = new Int32Array(this.bucketCount + 1);

    // Pass 1: how many bucket slots does each collider occupy?
    let totalSpans = 0;
    for (let i = 0; i < cs.count; i++) {
      const b0 = this._bucketOf(cs.envMinZ[i]);
      const b1 = this._bucketOf(cs.envMaxZ[i]);
      for (let b = b0; b <= b1; b++) counts[b]++;
      totalSpans += b1 - b0 + 1;
    }

    // Pass 2: prefix sum into CSR offsets.
    this.bucketStart = new Int32Array(this.bucketCount + 1);
    let running = 0;
    for (let b = 0; b < this.bucketCount; b++) {
      this.bucketStart[b] = running;
      running += counts[b];
    }
    this.bucketStart[this.bucketCount] = running;

    // Pass 3: scatter. `cursor` walks each bucket's slice as it fills.
    this.bucketItems = new Int32Array(totalSpans);
    const cursor = new Int32Array(this.bucketCount);
    for (let b = 0; b < this.bucketCount; b++) cursor[b] = this.bucketStart[b];
    for (let i = 0; i < cs.count; i++) {
      const b0 = this._bucketOf(cs.envMinZ[i]);
      const b1 = this._bucketOf(cs.envMaxZ[i]);
      for (let b = b0; b <= b1; b++) this.bucketItems[cursor[b]++] = i;
    }

    this.visitStamp = 0;
    this.overflowCount = 0;
    cs.stamp.fill(0);
    return this;
  }

  _bucketOf(z) {
    const b = Math.floor((z - this.originZ) / this.bucketSize);
    return b < 0 ? 0 : b >= this.bucketCount ? this.bucketCount - 1 : b;
  }

  /**
   * Collects collider indices whose Z range intersects [minZ, maxZ].
   *
   * @param {number} minZ
   * @param {number} maxZ
   * @param {Int32Array} out    caller-owned scratch, reused every call
   * @param {number} kindMask   bitmask over KIND; 0 means accept every kind
   * @returns {number} how many indices were written into `out`
   */
  query(minZ, maxZ, out, kindMask = 0) {
    const cs = this.cs;
    if (!cs || cs.count === 0) return 0;

    const stamp = ++this.visitStamp;
    const cap = out.length;
    const b0 = this._bucketOf(minZ);
    const b1 = this._bucketOf(maxZ);
    const items = this.bucketItems;
    const stamps = cs.stamp;
    let n = 0;

    for (let b = b0; b <= b1; b++) {
      const end = this.bucketStart[b + 1];
      for (let k = this.bucketStart[b]; k < end; k++) {
        const i = items[k];
        if (stamps[i] === stamp) continue;
        stamps[i] = stamp;
        if (cs.maxZ[i] <= minZ || cs.minZ[i] >= maxZ) continue;
        if (kindMask !== 0 && (kindMask & (1 << cs.kind[i])) === 0) continue;
        if (n === cap) {
          this.overflowCount++;
          return n;
        }
        out[n++] = i;
      }
    }
    return n;
  }
}
