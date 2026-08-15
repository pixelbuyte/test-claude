/**
 * The assembled, runnable level.
 *
 * Owns the collider set, the broadphase index over it, the moving platforms and
 * the trigger side-tables. Everything here is deterministic: platform positions
 * are a pure function of the tick count rather than integrated state, so a
 * respawn puts every platform back exactly where it was without any rollback
 * machinery.
 */
import { STEP, LEVEL, KIND, FLAG, MOVEMENT, kindMask } from '../../config.js';
import { Broadphase } from './broadphase.js';
import { makeAABB, setBodyAABB } from './colliderSet.js';
import { overlapBox } from './sweep.js';
import { clamp, lerp } from '../math/scalar.js';
import { EV } from '../core/events.js';

const TRIGGER_MASK = kindMask(KIND.TRIGGER);

export const PICKUP = {
  COIN: 0,
  SHARD: 1,
  POWERUP: 2,
};

export class World {
  /**
   * @param {object} data assembled level data - see level/assemble.js
   */
  constructor(data) {
    this.cs = data.colliders;
    this.broadphase = new Broadphase(LEVEL.bucketSize).build(this.cs);

    this.candidates = new Int32Array(LEVEL.queryCapacity);
    this.candidateCount = 0;

    this.movers = data.movers || [];
    this.pickups = data.pickups || [];
    this.pickupTaken = new Uint8Array(this.pickups.length);
    this.checkpoints = data.checkpoints || [];
    this.chunkRanges = data.chunkRanges || [];
    this.routes = data.routes || [];

    this.finishZ = data.finishZ ?? 0;
    this.startZ = data.startZ ?? 0;
    this.totalLength = Math.max(1, this.finishZ - this.startZ);
    this.floorY = data.floorY ?? -30;

    this.speedCurve = data.speedCurve || { start: 9, base: 14, max: 20, accelPerSec: 0.25 };
    this.theme = data.theme || 'rooftops';
    this.levelId = data.levelId || 'unknown';
    this.coinTotal = this.pickups.filter((p) => p.type === PICKUP.COIN).length;

    this.tick = 0;
    this._aabb = makeAABB();
    this._hits = new Int32Array(24);
  }

  /**
   * Narrows the collider set to those near `z`. Called once per racer per
   * substep; the margin covers one step of travel plus the deepest probe reach.
   */
  refresh(z, margin = 7) {
    this.candidateCount = this.broadphase.query(z - margin, z + margin, this.candidates);
    return this.candidateCount;
  }

  /**
   * Repositions moving platforms. Position is derived from the tick, never
   * accumulated, so there is no drift and no state to snapshot.
   */
  updateMovers(tick) {
    this.tick = tick;
    const t = tick * STEP;
    for (let k = 0; k < this.movers.length; k++) {
      const m = this.movers[k];
      const phase = Math.sin(2 * Math.PI * (t / m.period + m.phase));
      const off = m.amplitude * phase;
      this.cs.moveTo(m.index,
        m.originX + m.axisX * off,
        m.originY + m.axisY * off,
        m.originZ + m.axisZ * off);
    }
  }

  /** Target running speed at a point along the course. */
  baseSpeedAt(z) {
    const c = this.speedCurve;
    const progress = clamp((z - this.startZ) / this.totalLength, 0, 1);
    const ramped = c.start + (c.base - c.start) * Math.min(1, progress * 3);
    return clamp(ramped + progress * (c.max - c.base), MOVEMENT.speedMin, c.max);
  }

  /** Fractional progress along the course, which is also the race ranking key. */
  progressOf(z) {
    return clamp((z - this.startZ) / this.totalLength, 0, 1);
  }

  /** Lowest safe Y near `z`; falling well below it is a death. */
  floorAt(z) {
    for (let i = 0; i < this.chunkRanges.length; i++) {
      const r = this.chunkRanges[i];
      if (z >= r.z0 && z < r.z1) return r.floorY;
    }
    return this.floorY;
  }

  chunkIndexAt(z) {
    for (let i = 0; i < this.chunkRanges.length; i++) {
      const r = this.chunkRanges[i];
      if (z >= r.z0 && z < r.z1) return i;
    }
    return -1;
  }

  /**
   * Resolves trigger volumes overlapping the racer: pickups, checkpoints, boost
   * strips and the finish line. Pushes events; never mutates gameplay rules
   * itself, so the collectible and power-up systems stay the single owners of
   * what a pickup actually means.
   */
  collectTriggers(p, ev, height) {
    const cs = this.cs;
    const body = setBodyAABB(this._aabb, p.pos.x, p.pos.y, p.pos.z,
      0.55, height, 0.55);
    const n = overlapBox(body, cs, this.candidates, this.candidateCount,
      TRIGGER_MASK, this._hits);

    for (let k = 0; k < n; k++) {
      const i = this._hits[k];
      const flags = cs.flags[i];
      const ref = cs.ref[i];

      if ((flags & FLAG.PICKUP) !== 0 && ref >= 0 && !this.pickupTaken[ref]) {
        this.pickupTaken[ref] = 1;
        const pick = this.pickups[ref];
        if (pick.type === PICKUP.COIN) ev.push(EV.COIN, p.index, ref, pick.value);
        else if (pick.type === PICKUP.SHARD) ev.push(EV.SHARD, p.index, ref, pick.value);
        else ev.push(EV.POWERUP_PICKUP, p.index, ref, pick.value);
        continue;
      }

      if ((flags & FLAG.BOOST) !== 0) {
        ev.push(EV.BOOST_PAD, p.index, i);
        continue;
      }

      if ((flags & FLAG.CHECKPOINT) !== 0 && ref > p.checkpointIndex) {
        ev.push(EV.CHECKPOINT, p.index, ref);
        continue;
      }

      if ((flags & FLAG.FINISH) !== 0) {
        ev.push(EV.FINISH, p.index);
      }
    }
  }

  /** Resets per-race mutable state so a retry starts from a clean world. */
  reset() {
    this.pickupTaken.fill(0);
    this.tick = 0;
    this.updateMovers(0);
  }
}

/**
 * Magnet power-up support: pulls uncollected coins toward a racer. Returns the
 * number of coins pulled, purely so the VFX layer can react.
 */
export function applyMagnet(world, p, radius, ev) {
  const r2 = radius * radius;
  let pulled = 0;
  for (let i = 0; i < world.pickups.length; i++) {
    if (world.pickupTaken[i]) continue;
    const pk = world.pickups[i];
    if (pk.type !== PICKUP.COIN) continue;
    const dz = pk.z - p.pos.z;
    if (dz < -2 || dz > radius) continue;
    const dx = pk.x - p.pos.x;
    const dy = pk.y - (p.pos.y + 0.9);
    if (dx * dx + dy * dy + dz * dz > r2) continue;
    world.pickupTaken[i] = 1;
    ev.push(EV.COIN, p.index, i, pk.value);
    pulled++;
  }
  return pulled;
}
