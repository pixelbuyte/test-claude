/**
 * Fixed-capacity object pool.
 *
 * Acquire returns a recycled instance or null when exhausted - it never grows,
 * because a pool that grows under load is just a slower allocator.
 */
export class Pool {
  /**
   * @param {number} capacity
   * @param {() => object} factory  builds one instance during construction
   * @param {(obj: object) => void} [reset]  called on release
   */
  constructor(capacity, factory, reset = null) {
    this.capacity = capacity;
    this.reset = reset;
    this.items = new Array(capacity);
    this.free = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.items[i] = factory();
      this.free[i] = i;
    }
    this.freeCount = capacity;
    this.exhaustedCount = 0;
  }

  /** Returns a pooled object, or null if the pool is empty. */
  acquire() {
    if (this.freeCount === 0) {
      this.exhaustedCount++;
      return null;
    }
    const idx = this.free[--this.freeCount];
    return this.items[idx];
  }

  /** Returns the index of a pooled object, or -1. Useful for parallel arrays. */
  acquireIndex() {
    if (this.freeCount === 0) {
      this.exhaustedCount++;
      return -1;
    }
    return this.free[--this.freeCount];
  }

  releaseIndex(idx) {
    if (this.freeCount >= this.capacity) return;
    if (this.reset) this.reset(this.items[idx]);
    this.free[this.freeCount++] = idx;
  }

  get inUse() {
    return this.capacity - this.freeCount;
  }

  releaseAll() {
    for (let i = 0; i < this.capacity; i++) {
      if (this.reset) this.reset(this.items[i]);
      this.free[i] = i;
    }
    this.freeCount = this.capacity;
  }
}
