/**
 * Level assembly.
 *
 * Concatenates validated chunks into a course. The assembler can only ever
 * place a shape from the kit - it never invents geometry - which is what makes
 * completability something that can be proved once per shape rather than
 * re-argued per level.
 *
 * Selection is seeded, so a level is a fixed piece of content: the same seed
 * always produces the same course, and a seed that plays well is worth keeping.
 *
 * Generation is **total**. If no candidate satisfies the connection contract,
 * the guaranteed-admissible `run-neutral` chunk is placed instead, so the
 * assembler can never fail to produce a level.
 */
import { LEVEL, KIND, FLAG, SURFACE } from '../../config.js';
import { Rng } from '../math/prng.js';
import { LevelBuilder } from './builder.js';
import { CHUNKS, CHUNKS_BY_ID, FALLBACK_CHUNK } from '../../data/chunks/kit.js';
import { PICKUP } from '../world/World.js';

/** Do two lane sets share a lane? */
function lanesIntersect(a, b) {
  for (const l of a) if (b.includes(l)) return true;
  return false;
}

/** Speed the runner is projected to have arriving at `z`. */
function projectedSpeed(curve, z, totalLength) {
  const t = totalLength > 0 ? Math.min(1, Math.max(0, z / totalLength)) : 0;
  const ramped = curve.start + (curve.base - curve.start) * Math.min(1, t * 3);
  return Math.min(curve.max, ramped + t * (curve.max - curve.base));
}

/**
 * Is `chunk` a legal successor to the current course state?
 *
 * The three clauses are the whole connection contract: lanes must meet, heights
 * must match, and the runner must be fast enough for what the chunk asks.
 */
export function isAdmissible(chunk, state) {
  if (!lanesIntersect(chunk.entry.lanes, state.exitLanes)) return false;
  if (Math.abs(chunk.entry.y - state.exitY) > 0.01) return false;
  if (state.speed < chunk.entry.minSpeed) return false;
  return true;
}

/** Pacing rules, expressed as a weight rather than a hard filter. */
function weightFor(chunk, state, rules) {
  let w = rules.tagWeights?.[chunk.tags[0]] ?? 1;
  if (w <= 0) return 0;

  // Never the same chunk twice running.
  if (chunk.id === state.lastId) return 0;

  // Cap runs of the same tag, so a course does not become all vaults.
  const primary = chunk.tags[0];
  if (primary === state.lastTag && state.sameTagRun >= LEVEL.maxConsecutiveSameTag) return 0;

  // After a hard streak, strongly prefer a rest.
  if (state.hardStreak >= LEVEL.restAfterHardStreak) {
    if (chunk.difficulty <= 1) w *= 8;
    else w *= 0.05;
  }

  // Pull difficulty toward the level's target curve rather than fixing it, so
  // a course still varies but trends the way the designer asked.
  const distance = Math.abs(chunk.difficulty - state.targetDifficulty);
  w *= 1 / (1 + distance * distance);

  return w;
}

/**
 * Assembles a level from a definition.
 *
 * @param {object} def
 *   { levelId, theme, seed, speedCurve, intro[], tailChunks, outro[], rules,
 *     difficultyCurve: (t) => number }
 */
export function assembleLevel(def) {
  const rng = new Rng(def.seed ?? 1, `layout:${def.levelId}`);
  const b = new LevelBuilder({
    levelId: def.levelId,
    theme: def.theme || 'rooftops',
    speedCurve: def.speedCurve,
    startZ: 0,
    floorY: def.floorY ?? -30,
  });

  const rules = def.rules || {};
  const state = {
    exitLanes: [-1, 0, 1],
    exitY: 0,
    speed: def.speedCurve.start,
    lastId: null,
    lastTag: null,
    sameTagRun: 0,
    hardStreak: 0,
    targetDifficulty: 1,
  };

  // A lead-in so the runner is up to speed before being asked anything.
  //
  // The authored intro advances the same state the tail selection reads. Without
  // this the tail is chosen as though the intro never happened: it would not know
  // which chunk it is following, and - worse - would not know what height the
  // intro left the runner at.
  const sequence = [];
  for (const id of def.intro || []) {
    const c = CHUNKS_BY_ID[id];
    if (c) {
      sequence.push(c);
      advanceState(state, c);
    }
  }

  const tailCount = def.tailChunks ?? 0;
  const estimatedTotal = 24 * ((def.intro?.length || 0) + tailCount + (def.outro?.length || 0));

  // --- Choose the tail -----------------------------------------------------
  for (let i = 0; i < tailCount; i++) {
    const t = tailCount > 1 ? i / (tailCount - 1) : 0;
    state.targetDifficulty = def.difficultyCurve ? def.difficultyCurve(t) : 1 + t * 2;
    state.speed = projectedSpeed(def.speedCurve, sequence.length * 24, estimatedTotal);

    const candidates = [];
    const weights = [];
    for (const c of CHUNKS) {
      if (!isAdmissible(c, state)) continue;
      const w = weightFor(c, state, rules);
      if (w > 0) {
        candidates.push(c);
        weights.push(w);
      }
    }

    // If nothing qualifies, the fallback always does. Generation cannot fail.
    const pickIndex = candidates.length > 0 ? rng.pickWeightedIndex(weights) : -1;
    const chosen = pickIndex >= 0 ? candidates[pickIndex] : fallbackFor(state);

    sequence.push(chosen);
    advanceState(state, chosen);
  }

  for (const id of def.outro || []) {
    const c = CHUNKS_BY_ID[id];
    // Skip an outro chunk the tail already happens to have ended on: a calm
    // run-out is authored intent, and doing it twice just pads the course.
    if (c && isAdmissible(c, state) && c.id !== state.lastId) {
      sequence.push(c);
      advanceState(state, c);
    }
  }

  // The course must end at ground level, whatever the tail did.
  if (state.exitY !== 0) {
    const down = CHUNKS_BY_ID['ramp-down'];
    if (down && Math.abs(down.entry.y - state.exitY) < 0.01) {
      sequence.push(down);
      advanceState(state, down);
    }
  }

  // --- Place it ------------------------------------------------------------
  let z = 0;
  let y = 0;
  for (let i = 0; i < sequence.length; i++) {
    const chunk = sequence[i];
    const mirror = chunk.mirrorable !== false && rng.chance(0.5);
    b.section(z, z + chunk.length, (y || 0) - 30);
    placeChunk(b, chunk, z, y, mirror);

    if (i > 0 && i % LEVEL.checkpointEveryChunks === 0) {
      b.checkpoint(z + 1, 0, chunk.entry.y + y - chunk.entry.y);
    }

    z += chunk.length;
    y += chunk.exit.y - chunk.entry.y;
  }

  b.finish(z + 6, y);
  // A short run-out past the line so crossing it does not mean falling off.
  b.box(-5, y - 1, z, 5, y, z + 24, { kind: KIND.SOLID });
  b.section(z, z + 24, y - 30);

  const level = b.build();
  level.seed = def.seed ?? 1;
  level.chunkSequence = sequence.map((c) => c.id);
  return level;
}

/**
 * The chunk to place when nothing else qualifies.
 *
 * Normally the declared fallback, but never the chunk we just placed - a
 * doubled chunk reads as a glitch. Any other chunk that asks nothing of the
 * runner will do, and the kit validator proves at least one exists.
 */
function fallbackFor(state) {
  if (FALLBACK_CHUNK.id !== state.lastId) return FALLBACK_CHUNK;
  const alternate = CHUNKS.find((c) => c.id !== state.lastId
    && c.entry.minSpeed === 0
    && c.entry.y === state.exitY
    && c.exit.y === c.entry.y
    && c.entry.lanes.length >= 3);
  return alternate || FALLBACK_CHUNK;
}

function advanceState(state, chunk) {
  const primary = chunk.tags[0];
  state.sameTagRun = primary === state.lastTag ? state.sameTagRun + 1 : 1;
  state.lastTag = primary;
  state.lastId = chunk.id;
  state.exitLanes = chunk.exit.lanes;
  state.exitY = chunk.exit.y;
  state.hardStreak = chunk.difficulty >= 3 ? state.hardStreak + 1 : 0;
}

/** Writes one chunk's boxes and pickups into the builder at (z, y). */
function placeChunk(b, chunk, z, y, mirror) {
  const dy = y - chunk.entry.y;

  for (const box of chunk.boxes) {
    const x0 = mirror ? -box.x1 : box.x0;
    const x1 = mirror ? -box.x0 : box.x1;
    b.box(
      x0, box.y0 + dy, box.z0 + z,
      x1, box.y1 + dy, box.z1 + z,
      {
        kind: box.kind ?? KIND.SOLID,
        flags: box.flags ?? 0,
        surface: box.surface ?? SURFACE.CONCRETE,
      },
    );
  }

  for (const p of chunk.pickups || []) {
    const px = mirror ? -p.x : p.x;
    if (p.type === 'coin') b.coin(px, p.y + dy, p.z + z);
    else if (p.type === 'shard') b.shard(px, p.y + dy, p.z + z);
    else if (p.type) b.powerup(px, p.y + dy, p.z + z, p.type);
  }
}

/** Gaps in world coordinates, for the validator. */
export function gapsOf(level, sequence) {
  const out = [];
  let z = 0;
  for (const id of sequence) {
    const chunk = CHUNKS_BY_ID[id];
    if (!chunk) continue;
    for (const g of chunk.gaps || []) {
      out.push({ z0: g.z0 + z, z1: g.z1 + z, mode: g.mode, chunkId: id });
    }
    z += chunk.length;
  }
  return out;
}

export { PICKUP };
