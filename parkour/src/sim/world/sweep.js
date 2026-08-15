/**
 * Swept AABB collision, resolved one axis at a time.
 *
 * Because every collider is axis-aligned, a single-axis sweep reduces to a
 * static overlap test on the other two axes plus one division - exact, with no
 * iteration and no tolerance fudging. At the game's top speed the body moves
 * 0.37 m per substep, far less than any collider, but sweeping rather than
 * teleport-and-test makes tunnelling structurally impossible regardless of how
 * fast a boost pad ever gets tuned.
 */
import { KIND, FLAG } from '../../config.js';
import { overlapsAll } from './colliderSet.js';

/** For axis a, the other two axes. Flat arrays so lookups never allocate. */
const OTHER_A = [1, 0, 0];
const OTHER_B = [2, 2, 1];

/** Nudge back from the exact contact point so the next sweep starts outside. */
const SKIN = 1e-4;

export function makeSweepResult() {
  return { toi: 1, index: -1, dir: 0, penetrating: false };
}

/**
 * Sweeps `aabb` by `delta` along `axis` against the candidate colliders.
 *
 * @returns the `result` object: `toi` in [0,1], `index` of the first collider
 *          hit (-1 for none), `dir` the sweep direction sign.
 */
export function sweepAxis(aabb, axis, delta, cs, candidates, n, kindMask, result) {
  result.toi = 1;
  result.index = -1;
  result.penetrating = false;
  result.dir = delta > 0 ? 1 : delta < 0 ? -1 : 0;
  if (delta === 0) return result;

  const oa = OTHER_A[axis];
  const ob = OTHER_B[axis];
  const minA = cs.min[axis];
  const maxA = cs.max[axis];
  const bodyMin = aabb.min[axis];
  const bodyMax = aabb.max[axis];
  const moveUp = delta > 0;

  let best = 1;
  let bestIndex = -1;

  for (let k = 0; k < n; k++) {
    const i = candidates[k];
    const kind = cs.kind[i];
    if (kind === KIND.TRIGGER || kind === KIND.RAIL) continue;
    if (kindMask !== 0 && (kindMask & (1 << kind)) === 0) continue;

    // Must overlap on the two axes we are not sweeping, or the paths can't meet.
    if (aabb.max[oa] <= cs.min[oa][i] || aabb.min[oa] >= cs.max[oa][i]) continue;
    if (aabb.max[ob] <= cs.min[ob][i] || aabb.min[ob] >= cs.max[ob][i]) continue;

    const cMin = minA[i];
    const cMax = maxA[i];

    // One-way platforms only stop a body falling onto them from above.
    if ((cs.flags[i] & FLAG.ONE_WAY) !== 0) {
      if (axis !== 1 || moveUp || bodyMin < cMax - SKIN) continue;
    }

    let t;
    if (moveUp) {
      if (bodyMax > cMin) {
        // Already inside on this axis: penetrating, or moving away from contact.
        if (bodyMin < cMax) { best = 0; bestIndex = i; result.penetrating = true; break; }
        continue;
      }
      t = (cMin - bodyMax) / delta;
    } else {
      if (bodyMin < cMax) {
        if (bodyMax > cMin) { best = 0; bestIndex = i; result.penetrating = true; break; }
        continue;
      }
      t = (cMax - bodyMin) / delta;
    }

    if (t >= 0 && t < best) {
      best = t;
      bestIndex = i;
    }
  }

  result.toi = best;
  result.index = bestIndex;
  return result;
}

/** Distance the body may safely travel along `axis` this substep. */
export function safeDelta(delta, result) {
  if (result.index < 0) return delta;
  const advanced = delta * result.toi;
  // Back off by a hair so the next sweep starts strictly outside the surface.
  return advanced - Math.sign(delta) * SKIN;
}

/**
 * Collects every collider overlapping `aabb`. Used by the parkour affordance
 * probes and by trigger resolution.
 *
 * @returns the number of indices written into `out`.
 */
export function overlapBox(aabb, cs, candidates, n, kindMask, out) {
  const cap = out.length;
  let m = 0;
  for (let k = 0; k < n; k++) {
    const i = candidates[k];
    if (kindMask !== 0 && (kindMask & (1 << cs.kind[i])) === 0) continue;
    if (!overlapsAll(aabb, cs, i)) continue;
    if (m === cap) break;
    out[m++] = i;
  }
  return m;
}

export function makeGroundResult() {
  return {
    hit: false, y: 0, index: -1, surface: 0,
    isRamp: false, isPlatform: false, slope: 0,
  };
}

/**
 * Finds the highest supporting surface under the body footprint within `depth`.
 *
 * Ramps report their analytic height at the body's Z rather than their box top,
 * which is what keeps a slope feeling like a slope instead of a staircase.
 */
export function groundProbe(x, y, z, halfX, halfZ, depth, cs, candidates, n, result) {
  result.hit = false;
  result.index = -1;
  result.y = y - depth;
  result.surface = 0;
  result.isRamp = false;
  result.isPlatform = false;
  result.slope = 0;

  const bodyMinX = x - halfX, bodyMaxX = x + halfX;
  const bodyMinZ = z - halfZ, bodyMaxZ = z + halfZ;
  const lowest = y - depth;
  // Small upward tolerance so resting exactly on a surface still registers.
  const highest = y + 0.05;
  let bestY = -Infinity;
  let bestIndex = -1;
  let bestIsRamp = false;

  for (let k = 0; k < n; k++) {
    const i = candidates[k];
    const kind = cs.kind[i];
    if (kind === KIND.TRIGGER || kind === KIND.RAIL) continue;
    if (bodyMaxX <= cs.minX[i] || bodyMinX >= cs.maxX[i]) continue;
    if (bodyMaxZ <= cs.minZ[i] || bodyMinZ >= cs.maxZ[i]) continue;

    const isRamp = kind === KIND.RAMP;
    const surfaceY = isRamp ? cs.rampY(i, z) : cs.maxY[i];
    if (surfaceY > highest || surfaceY < lowest) continue;
    if (surfaceY > bestY) {
      bestY = surfaceY;
      bestIndex = i;
      bestIsRamp = isRamp;
    }
  }

  if (bestIndex >= 0) {
    result.hit = true;
    result.y = bestY;
    result.index = bestIndex;
    result.surface = cs.surface[bestIndex];
    result.isRamp = bestIsRamp;
    result.isPlatform = (cs.flags[bestIndex] & FLAG.MOVING) !== 0;
    if (bestIsRamp) {
      const dz = cs.maxZ[bestIndex] - cs.minZ[bestIndex];
      const dy = cs.maxY[bestIndex] - cs.minY[bestIndex];
      const descending = (cs.flags[bestIndex] & FLAG.RAMP_DESC) !== 0;
      result.slope = dz > 0 ? (descending ? -dy / dz : dy / dz) : 0;
    }
  }
  return result;
}

/**
 * Distance from `fromZ` forward to the first ground surface under the lane, or
 * `maxDistance` if the ground is continuous. Drives gap detection for both the
 * player's jump hints and the AI's decision to leave the floor.
 */
export function gapAhead(x, y, fromZ, maxDistance, halfX, cs, candidates, n) {
  const step = 0.5;
  const probeDepth = 2.5;
  const ground = makeGroundResult();
  for (let d = step; d <= maxDistance; d += step) {
    groundProbe(x, y + 0.2, fromZ + d, halfX, 0.15, probeDepth, cs, candidates, n, ground);
    if (!ground.hit) return d;
  }
  return maxDistance;
}
