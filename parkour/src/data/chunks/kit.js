/**
 * The chunk kit.
 *
 * A chunk is **static data**, never a generator function. That is the whole
 * reason completability is provable: a finite set of shapes is validated once,
 * and the assembler is only ever allowed to concatenate validated shapes.
 * Variety comes from selection, X-mirroring and pacing rules - not from
 * geometry invented at runtime, which could not be checked.
 *
 * Coordinates are local: z runs 0..length, x is centred on 0, y is relative to
 * the chunk's entry height. The assembler offsets them.
 *
 * Every chunk declares:
 *   entry { lanes, y, minSpeed }  what it needs from whatever precedes it
 *   exit  { lanes, y }            what it leaves the runner with
 *   gaps  [{ z0, z1, mode }]      holes the validator must prove are crossable
 *
 * A gap's `mode` says how it is meant to be crossed - 'jump' (the default) or
 * 'wallrun'. The validator proves the declared route, so a wall-run gap is
 * checked against wall-run reach rather than jump reach. Declaring the route is
 * what lets a chunk be wider than a jump without being unplayable.
 *
 * A candidate is admissible only if its entry lanes intersect the previous
 * exit's, its height matches, and the projected speed meets `minSpeed`.
 */
import { KIND, FLAG, SURFACE } from '../../config.js';

const ALL_LANES = [-1, 0, 1];
const HALF = 5;

/** Full-width running surface. */
function floor(z0, z1, y = 0) {
  return { x0: -HALF, y0: y - 1, z0, x1: HALF, y1: y, z1, kind: KIND.SOLID };
}

/** Boundary walls, so the track reads as a corridor and nobody falls sideways. */
function rails(z0, z1, y = 0) {
  return [
    { x0: -HALF - 0.6, y0: y, z0, x1: -HALF, y1: y + 5, z1, kind: KIND.SOLID, flags: FLAG.NO_WALLRUN },
    { x0: HALF, y0: y, z0, x1: HALF + 0.6, y1: y + 5, z1, kind: KIND.SOLID, flags: FLAG.NO_WALLRUN },
  ];
}

function vault(z, top = 0.9, depth = 0.8, halfWidth = 2.2, x = 0) {
  return {
    x0: x - halfWidth, y0: 0, z0: z, x1: x + halfWidth, y1: top, z1: z + depth,
    kind: KIND.VAULTABLE,
  };
}

function bar(z, clearance = 0.95, depth = 1.2) {
  return {
    x0: -HALF, y0: clearance, z0: z, x1: HALF, y1: 3.4, z1: z + depth,
    kind: KIND.SOLID,
  };
}

/** A wall inside the lane clamp, so it is actually reachable to run on. */
function runWall(side, z0, z1, y = 0) {
  const inner = side < 0 ? -2.9 : 2.9;
  const outer = inner + side * 0.7;
  return {
    x0: Math.min(inner, outer), y0: y, z0,
    x1: Math.max(inner, outer), y1: y + 6, z1,
    kind: KIND.WALLRUNNABLE,
  };
}

function coin(x, y, z) {
  return { x, y, z, type: 'coin' };
}

/**
 * @typedef {object} Chunk
 * @property {string} id
 * @property {string[]} tags       used by the pacing rules
 * @property {number} difficulty   0 (rest) to 4 (hard)
 * @property {number} length       metres along Z
 * @property {boolean} [mirrorable] false for chunks that are already symmetric
 */

export const CHUNKS = [
  // --- Neutral -------------------------------------------------------------
  {
    // The guaranteed-admissible fallback. Generation is total because this
    // chunk accepts every lane set, needs no speed, and changes nothing.
    id: 'run-neutral',
    tags: ['rest'],
    difficulty: 0,
    length: 20,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 0 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    boxes: [floor(0, 20), ...rails(0, 20)],
    pickups: [coin(0, 1.2, 6), coin(0, 1.2, 10), coin(0, 1.2, 14)],
    gaps: [],
  },
  {
    id: 'run-coins-weave',
    tags: ['rest', 'collect'],
    difficulty: 1,
    length: 24,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 0 },
    exit: { lanes: ALL_LANES, y: 0 },
    boxes: [floor(0, 24), ...rails(0, 24)],
    pickups: [
      coin(-2.2, 1.2, 5), coin(-2.2, 1.2, 7), coin(0, 1.2, 11),
      coin(2.2, 1.2, 15), coin(2.2, 1.2, 17), coin(0, 1.2, 21),
    ],
    gaps: [],
  },

  // --- Vaults --------------------------------------------------------------
  {
    id: 'vault-single',
    tags: ['vault'],
    difficulty: 1,
    length: 22,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 7 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    boxes: [floor(0, 22), ...rails(0, 22), vault(9, 0.9)],
    pickups: [coin(0, 1.7, 10), coin(0, 1.4, 12)],
    gaps: [],
  },
  {
    id: 'vault-stagger',
    tags: ['vault'],
    difficulty: 2,
    length: 30,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 8 },
    exit: { lanes: ALL_LANES, y: 0 },
    boxes: [
      floor(0, 30), ...rails(0, 30),
      vault(7, 0.85, 0.8, 2.0, -2.4),
      vault(15, 0.85, 0.8, 2.0, 2.4),
      vault(23, 1.0, 0.9, 2.2, 0),
    ],
    pickups: [coin(-2.4, 1.6, 8), coin(2.4, 1.6, 16), coin(0, 1.7, 24)],
    gaps: [],
  },

  // --- Slides --------------------------------------------------------------
  {
    id: 'slide-single',
    tags: ['slide'],
    difficulty: 1,
    length: 22,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 6 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    boxes: [floor(0, 22), ...rails(0, 22), bar(9, 0.98, 1.4)],
    pickups: [coin(0, 0.5, 10), coin(0, 0.5, 11.5)],
    gaps: [],
  },
  {
    id: 'slide-tunnel',
    tags: ['slide'],
    difficulty: 3,
    length: 28,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 8 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    // A genuinely long duck. The slide has to be held, and the runner must not
    // be able to stand up inside it - which is exactly what ceilingBlocked
    // guarantees.
    boxes: [floor(0, 28), ...rails(0, 28), bar(9, 0.95, 7)],
    pickups: [coin(0, 0.5, 11), coin(0, 0.5, 13), coin(0, 0.5, 15)],
    gaps: [],
  },

  // --- Gaps ----------------------------------------------------------------
  {
    id: 'gap-single',
    tags: ['gap'],
    difficulty: 2,
    length: 26,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 9 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    boxes: [floor(0, 10), floor(16, 26), ...rails(0, 26)],
    pickups: [coin(0, 2.2, 13)],
    gaps: [{ z0: 10, z1: 16 }],
  },
  {
    id: 'gap-double',
    tags: ['gap'],
    difficulty: 3,
    length: 34,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 11 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    boxes: [floor(0, 9), floor(15, 22), floor(28, 34), ...rails(0, 34)],
    pickups: [coin(0, 2.4, 12), coin(0, 2.4, 25)],
    gaps: [{ z0: 9, z1: 15 }, { z0: 22, z1: 28 }],
  },

  // --- Wall-runs -----------------------------------------------------------
  {
    id: 'wallrun-ledge',
    tags: ['wallrun'],
    difficulty: 3,
    length: 32,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 11 },
    exit: { lanes: ALL_LANES, y: 0 },
    boxes: [
      floor(0, 10), floor(16, 32), ...rails(0, 32),
      // The floor between is a hazard, so the wall is the route rather than a
      // decorative option. The span is well inside the wall-run budget rather
      // than at the edge of it: gravity ramps back in over the second half of a
      // wall-run, so a span that only just fits at full speed drops a runner who
      // arrives a little slow - which, after a respawn, they always do.
      { x0: -HALF, y0: -1, z0: 10, x1: HALF, y1: 0, z1: 16, kind: KIND.TRIGGER, flags: FLAG.HAZARD },
      runWall(-1, 7, 19),
    ],
    pickups: [coin(-2.2, 2.6, 11), coin(-2.2, 2.6, 13), coin(-2.2, 2.6, 15)],
    gaps: [{ z0: 10, z1: 16, mode: 'wallrun' }],
  },

  // --- Height changes ------------------------------------------------------
  {
    id: 'step-up-mantle',
    tags: ['mantle', 'climb'],
    difficulty: 2,
    length: 28,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 9 },
    exit: { lanes: ALL_LANES, y: 1.5 },
    mirrorable: false,
    boxes: [
      floor(0, 12),
      { x0: -HALF, y0: -1.5, z0: 16, x1: HALF, y1: 1.5, z1: 28, kind: KIND.SOLID },
      ...rails(0, 12), ...rails(16, 28, 1.5),
    ],
    pickups: [coin(0, 2.6, 21)],
    gaps: [{ z0: 12, z1: 16 }],
  },
  {
    id: 'ramp-down',
    tags: ['descend'],
    difficulty: 1,
    length: 24,
    entry: { lanes: ALL_LANES, y: 1.5, minSpeed: 0 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    boxes: [
      { x0: -HALF, y0: 0.5, z0: 0, x1: HALF, y1: 1.5, z1: 6, kind: KIND.SOLID },
      { x0: -HALF, y0: -1, z0: 6, x1: HALF, y1: 1.5, z1: 16, kind: KIND.RAMP, flags: FLAG.RAMP_DESC },
      floor(16, 24),
      ...rails(0, 24, 1.5),
    ],
    pickups: [coin(0, 2.4, 9), coin(0, 1.6, 13)],
    gaps: [],
  },

  // --- Launch --------------------------------------------------------------
  {
    id: 'launch-hop',
    tags: ['launch'],
    difficulty: 2,
    length: 26,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 10 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    boxes: [
      floor(0, 10), floor(15.5, 26), ...rails(0, 26),
      // Full track width: a pad the runner can miss by drifting a lane is a pad
      // that drops them into the gap it exists to cross.
      { x0: -HALF, y0: 0, z0: 8, x1: HALF, y1: 0.06, z1: 9.6, kind: KIND.SOLID, flags: FLAG.BOOST, surface: SURFACE.METAL },
    ],
    // Crossed on the pad's arc, not the runner's own jump - so it is checked
    // against launch reach.
    pickups: [coin(0, 2.6, 11.5), coin(0, 2.8, 13)],
    gaps: [{ z0: 10, z1: 15.5, mode: 'launch' }],
  },
  {
    id: 'speed-strip',
    tags: ['boost', 'rest'],
    difficulty: 1,
    length: 22,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 0 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    boxes: [
      floor(0, 22), ...rails(0, 22),
      { x0: -2, y0: 0, z0: 8, x1: 2, y1: 0.4, z1: 12, kind: KIND.TRIGGER, flags: FLAG.BOOST },
    ],
    pickups: [coin(0, 1.2, 14), coin(0, 1.2, 16)],
    gaps: [],
  },

  // --- Mixed ---------------------------------------------------------------
  {
    id: 'mix-vault-slide',
    tags: ['vault', 'slide'],
    difficulty: 3,
    length: 32,
    entry: { lanes: ALL_LANES, y: 0, minSpeed: 9 },
    exit: { lanes: ALL_LANES, y: 0 },
    mirrorable: false,
    boxes: [floor(0, 32), ...rails(0, 32), vault(8, 0.9), bar(18, 0.98, 1.6), vault(26, 0.8)],
    pickups: [coin(0, 1.7, 9), coin(0, 0.5, 19), coin(0, 1.6, 27)],
    gaps: [],
  },
];

export const CHUNKS_BY_ID = (() => {
  const out = Object.create(null);
  for (const c of CHUNKS) out[c.id] = c;
  return out;
})();

export const FALLBACK_CHUNK = CHUNKS_BY_ID['run-neutral'];
