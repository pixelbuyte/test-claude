/**
 * Level validation.
 *
 * Proves, numerically, that an assembled course can actually be finished: every
 * gap is clearable at the speed the runner will arrive with, every step up is
 * surmountable, seams line up, and the finish is reachable.
 *
 * It reads the same `config.js` the movement controller does, via
 * `reachability.js`. Retuning the jump therefore re-validates every level
 * automatically - the failure surfaces as a failing test rather than as a
 * player stuck at chunk nine.
 */
import { LEVEL, KIND } from '../../config.js';
import { CHUNKS, CHUNKS_BY_ID } from '../../data/chunks/kit.js';
import { checkGap, checkStepUp, safeWallRun } from './reachability.js';
import { isAdmissible, gapsOf } from './assemble.js';

/**
 * @typedef {object} Problem
 * @property {string} kind
 * @property {string} message
 * @property {string} [chunkId]
 */

function speedAt(level, z) {
  const c = level.speedCurve;
  const total = Math.max(1, level.finishZ - level.startZ);
  const t = Math.min(1, Math.max(0, (z - level.startZ) / total));
  const ramped = c.start + (c.base - c.start) * Math.min(1, t * 3);
  return Math.min(c.max, ramped + t * (c.max - c.base));
}

/**
 * Validates one assembled level.
 *
 * @returns {{ok: boolean, problems: Problem[], stats: object}}
 */
export function validateLevel(level) {
  const problems = [];
  const push = (kind, message, chunkId) => problems.push({ kind, message, chunkId });

  const cs = level.colliders;

  // --- Structure -----------------------------------------------------------
  if (cs.count === 0) push('empty', 'level has no colliders');
  if (level.finishZ <= level.startZ) {
    push('length', `finish (${level.finishZ}) is not past the start (${level.startZ})`);
  }
  if (level.checkpoints.length === 0) push('checkpoints', 'level has no checkpoints');

  // Checkpoints must be in order, or respawning could send a runner backwards.
  for (let i = 1; i < level.checkpoints.length; i++) {
    if (level.checkpoints[i].z <= level.checkpoints[i - 1].z) {
      push('checkpoints', `checkpoint ${i} is not past checkpoint ${i - 1}`);
    }
  }

  // --- Gaps ----------------------------------------------------------------
  const gaps = level.chunkSequence ? gapsOf(level, level.chunkSequence) : [];
  for (const g of gaps) {
    const width = g.z1 - g.z0;
    const speed = speedAt(level, g.z0);
    const check = checkGap(width, speed, g.mode);
    if (!check.ok) {
      push('gap',
        `${width.toFixed(1)}m ${g.mode || 'jump'} gap at z=${g.z0.toFixed(0)} needs more `
        + `than the ${check.have.toFixed(1)}m reachable at ${speed.toFixed(1)} m/s`,
        g.chunkId);
    }
  }

  // --- Seams ---------------------------------------------------------------
  if (level.chunkSequence) {
    const state = { exitLanes: [-1, 0, 1], exitY: 0, speed: level.speedCurve.start };
    let z = 0;
    for (let i = 0; i < level.chunkSequence.length; i++) {
      const chunk = CHUNKS_BY_ID[level.chunkSequence[i]];
      if (!chunk) {
        push('unknown-chunk', `sequence references unknown chunk ${level.chunkSequence[i]}`);
        continue;
      }
      state.speed = speedAt(level, z);
      if (!isAdmissible(chunk, state)) {
        push('seam',
          `${chunk.id} at index ${i} does not connect: entry y=${chunk.entry.y} `
          + `minSpeed=${chunk.entry.minSpeed} vs exit y=${state.exitY} speed=${state.speed.toFixed(1)}`,
          chunk.id);
      }
      state.exitLanes = chunk.exit.lanes;
      state.exitY = chunk.exit.y;
      z += chunk.length;
    }
  }

  // --- Pickups -------------------------------------------------------------
  for (let i = 0; i < level.pickups.length; i++) {
    const p = level.pickups[i];
    if (p.z < level.startZ || p.z > level.finishZ + 30) {
      push('pickup', `pickup ${i} at z=${p.z.toFixed(0)} is outside the course`);
    }
  }

  const stats = {
    colliders: cs.count,
    length: level.finishZ - level.startZ,
    checkpoints: level.checkpoints.length,
    pickups: level.pickups.length,
    gaps: gaps.length,
    chunks: level.chunkSequence ? level.chunkSequence.length : 0,
  };

  return { ok: problems.length === 0, problems, stats };
}

/**
 * Validates the kit itself, independently of any level built from it.
 *
 * These are the invariants that make assembly safe: if every shape is sound and
 * every shape connects to the fallback, then any concatenation the assembler
 * produces is sound too.
 */
export function validateKit() {
  const problems = [];
  const push = (kind, message, chunkId) => problems.push({ kind, message, chunkId });

  const ids = new Set();
  for (const c of CHUNKS) {
    if (ids.has(c.id)) push('duplicate', `two chunks share the id ${c.id}`, c.id);
    ids.add(c.id);

    if (!(c.length > 0)) push('length', `${c.id} has no length`, c.id);
    if (!c.tags || c.tags.length === 0) push('tags', `${c.id} has no tags`, c.id);
    if (!c.entry || !c.exit) push('contract', `${c.id} is missing entry/exit`, c.id);
    if (!c.boxes || c.boxes.length === 0) push('geometry', `${c.id} has no geometry`, c.id);

    // Every gap must be clearable at the speed the chunk itself demands, or the
    // chunk is unplayable no matter where it is placed.
    for (const g of c.gaps || []) {
      const width = g.z1 - g.z0;
      const check = checkGap(width, c.entry.minSpeed, g.mode);
      if (!check.ok) {
        push('gap',
          `${c.id} declares a ${width.toFixed(1)}m ${g.mode || 'jump'} gap but only `
          + `requires ${c.entry.minSpeed} m/s, which reaches ${check.have.toFixed(1)}m`,
          c.id);
      }
      if (g.z0 < 0 || g.z1 > c.length) {
        push('gap', `${c.id} declares a gap outside its own length`, c.id);
      }
    }

    // Anything the chunk claims to climb has to be climbable.
    const rise = c.exit.y - c.entry.y;
    if (rise > 0) {
      const check = checkStepUp(rise, c.entry.minSpeed);
      if (!check.ok) {
        push('step', `${c.id} rises ${rise.toFixed(2)}m, above the reachable ${check.have.toFixed(2)}m`, c.id);
      }
    }

    for (const box of c.boxes) {
      if (box.x1 <= box.x0 || box.y1 <= box.y0 || box.z1 <= box.z0) {
        push('geometry', `${c.id} has an inverted or zero-volume box`, c.id);
      }
      if (box.z0 < -0.01 || box.z1 > c.length + 0.01) {
        push('geometry', `${c.id} has a box outside its own z range`, c.id);
      }
    }

    for (const p of c.pickups || []) {
      if (p.z < 0 || p.z > c.length) {
        push('pickup', `${c.id} has a pickup outside its own z range`, c.id);
      }
    }
  }

  // The fallback must accept everything, or generation is not total.
  const fallback = CHUNKS_BY_ID[LEVEL.fallbackChunkId];
  if (!fallback) {
    push('fallback', `the fallback chunk ${LEVEL.fallbackChunkId} is not in the kit`);
  } else {
    if (fallback.entry.minSpeed > 0) {
      push('fallback', 'the fallback chunk demands speed, so generation is not total');
    }
    if (fallback.entry.lanes.length < 3) {
      push('fallback', 'the fallback chunk does not accept every lane');
    }
    if (fallback.entry.y !== fallback.exit.y) {
      push('fallback', 'the fallback chunk changes height, so it cannot always be inserted');
    }
  }

  // Every chunk that changes height needs somewhere to go afterwards, or a
  // course can strand itself at altitude with no admissible successor.
  for (const c of CHUNKS) {
    if (c.exit.y === c.entry.y) continue;
    const successor = CHUNKS.find((n) => n !== c
      && Math.abs(n.entry.y - c.exit.y) < 0.01
      && n.entry.minSpeed <= 12);
    if (!successor) {
      push('dead-end', `${c.id} exits at y=${c.exit.y} with no chunk able to follow it`, c.id);
    }
  }

  return { ok: problems.length === 0, problems };
}

/** Formats problems for a test failure message. */
export function describeProblems(problems) {
  return problems.map((p) => `  [${p.kind}] ${p.message}`).join('\n');
}
