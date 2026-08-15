/**
 * Level construction.
 *
 * Collects geometry into plain arrays, then allocates the structure-of-arrays
 * collider set exactly once at the end. Both the hand-built practice track and
 * the chunk assembler build through this, so there is a single definition of
 * what an assembled level looks like.
 */
import { KIND, FLAG, SURFACE, MOVEMENT, LEVEL } from '../../config.js';
import { ColliderSet } from '../world/colliderSet.js';
import { PICKUP } from '../world/World.js';

export class LevelBuilder {
  constructor(opts = {}) {
    this.levelId = opts.levelId || 'sandbox';
    this.theme = opts.theme || 'rooftops';
    this.speedCurve = opts.speedCurve || { start: 9, base: 14, max: 20, accelPerSec: 0.25 };
    this.startZ = opts.startZ ?? 0;
    this.floorY = opts.floorY ?? -30;

    this._boxes = [];
    this.pickups = [];
    this.checkpoints = [];
    this.movers = [];
    this.chunkRanges = [];
    this.routes = [];
    this.guides = [];
    this.finishZ = opts.finishZ ?? 0;
  }

  /**
   * Adds one axis-aligned box.
   * @returns the index it will occupy in the finished collider set.
   */
  box(minX, minY, minZ, maxX, maxY, maxZ, opts = {}) {
    const rec = {
      minX, minY, minZ, maxX, maxY, maxZ,
      kind: opts.kind ?? KIND.SOLID,
      flags: opts.flags ?? 0,
      surface: opts.surface ?? SURFACE.CONCRETE,
      ref: opts.ref ?? -1,
      chunk: opts.chunk ?? this.chunkRanges.length - 1,
      envMinZ: opts.envMinZ,
      envMaxZ: opts.envMaxZ,
    };
    this._boxes.push(rec);
    return this._boxes.length - 1;
  }

  /** A stretch of running surface, centred on x = 0. */
  floor(z0, z1, y = 0, halfWidth = 5, opts = {}) {
    return this.box(-halfWidth, y - 1, z0, halfWidth, y, z1, opts);
  }

  /** A side wall. `side` is -1 for the left of the track, +1 for the right. */
  wall(side, z0, z1, yBase = 0, height = 6, thickness = 0.6, opts = {}) {
    const inner = side < 0 ? -5 : 5;
    const outer = inner + side * thickness;
    return this.box(Math.min(inner, outer), yBase, z0, Math.max(inner, outer), yBase + height, z1, {
      kind: KIND.WALLRUNNABLE, ...opts,
    });
  }

  /** A low obstacle the runner vaults rather than stops at. */
  vaultBox(z, y = 0, top = 0.9, depth = 0.8, halfWidth = 2.2, opts = {}) {
    return this.box(-halfWidth, y, z, halfWidth, y + top, z + depth, {
      kind: KIND.VAULTABLE, ...opts,
    });
  }

  /** An overhang with clear space beneath - a slide, not a wall. */
  slideBar(z, y = 0, clearance = 0.95, depth = 1.2, halfWidth = 5, opts = {}) {
    return this.box(-halfWidth, y + clearance, z, halfWidth, y + 3.2, z + depth, opts);
  }

  ramp(z0, z1, yLow, yHigh, halfWidth = 5, descending = false, opts = {}) {
    return this.box(-halfWidth, yLow - 1, z0, halfWidth, yHigh, z1, {
      ...opts,
      kind: KIND.RAMP,
      flags: (opts.flags ?? 0) | (descending ? FLAG.RAMP_DESC : 0),
    });
  }

  /** A pad that throws the runner upward on contact. */
  launchPad(z, y = 0, halfWidth = 1.6, depth = 1.4) {
    return this.box(-halfWidth, y - 0.1, z, halfWidth, y, z + depth, {
      kind: KIND.SOLID, flags: FLAG.BOOST, surface: SURFACE.METAL,
    });
  }

  /** A ground strip that adds forward speed. */
  speedStrip(z, depth = 3, y = 0, halfWidth = 2) {
    return this.box(-halfWidth, y, z, halfWidth, y + 0.4, z + depth, {
      kind: KIND.TRIGGER, flags: FLAG.BOOST,
    });
  }

  coin(x, y, z, value = 1) {
    const ref = this.pickups.length;
    this.pickups.push({ x, y, z, type: PICKUP.COIN, value });
    this.box(x - 0.5, y - 0.5, z - 0.5, x + 0.5, y + 0.5, z + 0.5, {
      kind: KIND.TRIGGER, flags: FLAG.PICKUP, ref,
    });
    return ref;
  }

  shard(x, y, z, value = 1) {
    const ref = this.pickups.length;
    this.pickups.push({ x, y, z, type: PICKUP.SHARD, value });
    this.box(x - 0.6, y - 0.6, z - 0.6, x + 0.6, y + 0.6, z + 0.6, {
      kind: KIND.TRIGGER, flags: FLAG.PICKUP, ref,
    });
    return ref;
  }

  /** `kind` indexes the POWERUPS table by name. */
  powerup(x, y, z, kindName) {
    const ref = this.pickups.length;
    this.pickups.push({ x, y, z, type: PICKUP.POWERUP, value: 0, powerup: kindName });
    this.box(x - 0.7, y - 0.7, z - 0.7, x + 0.7, y + 0.7, z + 0.7, {
      kind: KIND.TRIGGER, flags: FLAG.PICKUP, ref,
    });
    return ref;
  }

  checkpoint(z, x = 0, y = 0) {
    const ref = this.checkpoints.length;
    this.checkpoints.push({ index: ref, x, y, z });
    this.box(-6, y - 1, z, 6, y + 6, z + 0.6, {
      kind: KIND.TRIGGER, flags: FLAG.CHECKPOINT, ref,
    });
    return ref;
  }

  finish(z, y = 0) {
    this.finishZ = z;
    return this.box(-8, y - 2, z, 8, y + 8, z + 0.6, {
      kind: KIND.TRIGGER, flags: FLAG.FINISH,
    });
  }

  hazard(minX, minY, minZ, maxX, maxY, maxZ) {
    return this.box(minX, minY, minZ, maxX, maxY, maxZ, {
      kind: KIND.TRIGGER, flags: FLAG.HAZARD,
    });
  }

  /**
   * A platform that oscillates along `axis`. Registered with a broadphase
   * envelope covering its whole travel, so the CSR index stays valid while the
   * box itself moves.
   */
  movingPlatform(x, y, z, w, h, d, axis, amplitude, period, phase = 0) {
    const index = this.box(x, y, z, x + w, y + h, z + d, {
      kind: KIND.PLATFORM,
      flags: FLAG.MOVING,
      surface: SURFACE.METAL,
      envMinZ: z - (axis.z ? amplitude : 0),
      envMaxZ: z + d + (axis.z ? amplitude : 0),
    });
    this.movers.push({
      index,
      originX: x, originY: y, originZ: z,
      axisX: axis.x || 0, axisY: axis.y || 0, axisZ: axis.z || 0,
      amplitude, period, phase,
    });
    return index;
  }

  /** Records the Z span and safe floor of one course section. */
  section(z0, z1, floorY) {
    this.chunkRanges.push({ z0, z1, floorY });
    return this.chunkRanges.length - 1;
  }

  build() {
    const cs = new ColliderSet(Math.max(this._boxes.length, 1));
    for (const b of this._boxes) {
      const i = cs.add(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ,
        b.kind, b.flags, b.surface, b.ref, b.chunk);
      if (b.envMinZ !== undefined) cs.setEnvelopeZ(i, b.envMinZ, b.envMaxZ ?? b.maxZ);
    }
    if (this.chunkRanges.length === 0) {
      this.chunkRanges.push({ z0: this.startZ - 10, z1: this.finishZ + 40, floorY: this.floorY });
    }
    return {
      levelId: this.levelId,
      theme: this.theme,
      colliders: cs,
      pickups: this.pickups,
      checkpoints: this.checkpoints,
      movers: this.movers,
      chunkRanges: this.chunkRanges,
      routes: this.routes,
      guides: this.guides,
      startZ: this.startZ,
      finishZ: this.finishZ,
      floorY: this.floorY,
      speedCurve: this.speedCurve,
    };
  }
}
