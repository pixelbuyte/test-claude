/**
 * Structure-of-arrays collider storage.
 *
 * Every collider in a level is an axis-aligned box. That is not a limitation
 * dressed up as a choice - it is what makes the sweeps below exact and
 * branch-free, and it is why the whole simulation is cheap enough to run a full
 * race field in Node.
 *
 * The arrays are allocated once when a level is assembled and never resized.
 */
import { KIND, FLAG } from '../../config.js';
import { clamp01 } from '../math/scalar.js';

export class ColliderSet {
  constructor(capacity) {
    this.capacity = capacity;
    this.count = 0;

    this.minX = new Float32Array(capacity);
    this.minY = new Float32Array(capacity);
    this.minZ = new Float32Array(capacity);
    this.maxX = new Float32Array(capacity);
    this.maxY = new Float32Array(capacity);
    this.maxZ = new Float32Array(capacity);

    this.kind = new Uint8Array(capacity);
    this.flags = new Uint16Array(capacity);
    this.surface = new Uint8Array(capacity);
    /** Index into a parallel side-table (triggers, pickups, movers). */
    this.ref = new Int32Array(capacity);
    /** Owning chunk index - drives streaming and respawn. */
    this.chunk = new Int32Array(capacity);
    /** Monotonic visit marker used by the broadphase to dedupe, no Set needed. */
    this.stamp = new Uint32Array(capacity);

    // Moving platforms are bucketed by the full envelope they sweep through, so
    // the CSR index stays valid for the whole race while the live box below it
    // moves. Static colliders simply have envelope == bounds.
    this.envMinZ = new Float32Array(capacity);
    this.envMaxZ = new Float32Array(capacity);

    // Axis-indexed views so sweep code can be written once for all three axes
    // instead of three near-identical copies.
    this.min = [this.minX, this.minY, this.minZ];
    this.max = [this.maxX, this.maxY, this.maxZ];
  }

  add(minX, minY, minZ, maxX, maxY, maxZ, kind = KIND.SOLID, flags = 0,
      surface = 0, ref = -1, chunk = -1) {
    const i = this.count;
    if (i >= this.capacity) {
      throw new Error(`ColliderSet capacity ${this.capacity} exceeded`);
    }
    this.minX[i] = minX; this.minY[i] = minY; this.minZ[i] = minZ;
    this.maxX[i] = maxX; this.maxY[i] = maxY; this.maxZ[i] = maxZ;
    this.kind[i] = kind;
    this.flags[i] = flags;
    this.surface[i] = surface;
    this.ref[i] = ref;
    this.chunk[i] = chunk;
    this.stamp[i] = 0;
    this.envMinZ[i] = minZ;
    this.envMaxZ[i] = maxZ;
    this.count++;
    return i;
  }

  /** Widens collider `i`'s broadphase envelope to cover its full travel. */
  setEnvelopeZ(i, minZ, maxZ) {
    this.envMinZ[i] = Math.min(this.envMinZ[i], minZ);
    this.envMaxZ[i] = Math.max(this.envMaxZ[i], maxZ);
  }

  /** Repositions a moving collider, preserving its size. */
  moveTo(i, minX, minY, minZ) {
    const w = this.maxX[i] - this.minX[i];
    const h = this.maxY[i] - this.minY[i];
    const d = this.maxZ[i] - this.minZ[i];
    this.minX[i] = minX; this.maxX[i] = minX + w;
    this.minY[i] = minY; this.maxY[i] = minY + h;
    this.minZ[i] = minZ; this.maxZ[i] = minZ + d;
  }

  hasFlag(i, flag) {
    return (this.flags[i] & flag) !== 0;
  }

  /**
   * Surface height of a ramp at world Z. Ramps are never swept - resolving them
   * analytically avoids the stair-stepping you get from treating a slope as a
   * stack of boxes.
   */
  rampY(i, z) {
    const z0 = this.minZ[i];
    const z1 = this.maxZ[i];
    let t = z1 > z0 ? clamp01((z - z0) / (z1 - z0)) : 0;
    if ((this.flags[i] & FLAG.RAMP_DESC) !== 0) t = 1 - t;
    return this.minY[i] + (this.maxY[i] - this.minY[i]) * t;
  }

  /** Total Z extent of the level, used to size the broadphase. */
  boundsZ(out) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < this.count; i++) {
      if (this.envMinZ[i] < lo) lo = this.envMinZ[i];
      if (this.envMaxZ[i] > hi) hi = this.envMaxZ[i];
    }
    out.lo = this.count ? lo : 0;
    out.hi = this.count ? hi : 0;
    return out;
  }
}

/** An axis-indexed AABB. Float32Array(3) so `min[axis]` works without branching. */
export function makeAABB() {
  return { min: new Float32Array(3), max: new Float32Array(3) };
}

/** Centres a body box on (x, z) with its base at y. */
export function setBodyAABB(aabb, x, y, z, halfX, height, halfZ) {
  aabb.min[0] = x - halfX;
  aabb.min[1] = y;
  aabb.min[2] = z - halfZ;
  aabb.max[0] = x + halfX;
  aabb.max[1] = y + height;
  aabb.max[2] = z + halfZ;
  return aabb;
}

export function setBoxAABB(aabb, minX, minY, minZ, maxX, maxY, maxZ) {
  aabb.min[0] = minX; aabb.min[1] = minY; aabb.min[2] = minZ;
  aabb.max[0] = maxX; aabb.max[1] = maxY; aabb.max[2] = maxZ;
  return aabb;
}

/** True when `aabb` overlaps collider `i` on every axis except `skipAxis`. */
export function overlapsExceptAxis(aabb, cs, i, skipAxis) {
  for (let a = 0; a < 3; a++) {
    if (a === skipAxis) continue;
    if (aabb.max[a] <= cs.min[a][i] || aabb.min[a] >= cs.max[a][i]) return false;
  }
  return true;
}

export function overlapsAll(aabb, cs, i) {
  return aabb.max[0] > cs.minX[i] && aabb.min[0] < cs.maxX[i]
    && aabb.max[1] > cs.minY[i] && aabb.min[1] < cs.maxY[i]
    && aabb.max[2] > cs.minZ[i] && aabb.min[2] < cs.maxZ[i];
}
