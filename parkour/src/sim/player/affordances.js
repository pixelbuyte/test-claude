/**
 * Parkour affordance sensing.
 *
 * Every substep the player fires a small fixed set of box queries against the
 * same broadphase the movement resolver uses, and writes what it finds into one
 * reusable AffordanceSet. Nothing here decides what to do - it only reports what
 * is physically nearby. The state machine turns that into actions.
 *
 * The probes deliberately look further ahead than the body will travel in one
 * step. That lead distance is what makes a slightly-late input still land: by
 * the time the player reacts, the affordance has already been valid for a few
 * frames. Slightly-early inputs are covered from the other side by the jump
 * buffer. Together they are the "no pixel-perfect timing" guarantee.
 */
import { KIND, FLAG, BODY, PARKOUR, LEVEL, kindMask } from '../../config.js';
import { makeAABB, setBoxAABB } from '../world/colliderSet.js';
import { overlapBox, groundProbe, makeGroundResult, gapAhead } from '../world/sweep.js';

const SOLIDS = kindMask(KIND.SOLID, KIND.RAMP, KIND.WALLRUNNABLE, KIND.VAULTABLE, KIND.PLATFORM);
const WALLS = kindMask(KIND.WALLRUNNABLE, KIND.SOLID);
const RAILS = kindMask(KIND.RAIL);

export function makeAffordanceSet() {
  return {
    ground: makeGroundResult(),

    // Low obstacle the runner can hop straight over without losing speed.
    vaultValid: false,
    vaultIndex: -1,
    vaultTop: 0,
    vaultExitZ: 0,

    // Obstacle too tall to vault - running into it is a crash.
    blockerValid: false,
    blockerIndex: -1,

    // Overhang low enough that only a slide gets through.
    slideNeeded: false,
    slideIndex: -1,

    /**
     * Something directly overhead, right now. Distinct from `slideNeeded`, which
     * looks ahead: this answers "may the body stand back up where it is?" and is
     * what stops a slide ending inside the bar it just ducked under.
     */
    ceilingBlocked: false,

    // Wall-run candidates to either side. side is -1 (left) or +1 (right).
    wallLeftValid: false,
    wallLeftIndex: -1,
    wallLeftX: 0,
    wallRightValid: false,
    wallRightIndex: -1,
    wallRightX: 0,

    /**
     * A runnable wall within steering range and a little way ahead - not yet
     * close enough to latch onto.
     *
     * The adjacency probes above only fire within 0.45m, which is fine for the
     * player (who can see the wall) but leaves a driver unable to ever approach
     * one: it cannot detect the wall until it is already there, and will not go
     * there until it detects it. This is the signal that breaks that cycle.
     */
    wallNearLeft: false,
    wallNearRight: false,

    // Grabbable top edge just above head height.
    ledgeValid: false,
    ledgeIndex: -1,
    ledgeY: 0,

    // Distance to the next hole in the floor, capped at the probe range.
    gapDistance: 0,

    railValid: false,
    railIndex: -1,
    railY: 0,

    launchValid: false,
    launchIndex: -1,

    hazardTouch: false,
    hazardIndex: -1,

    // Scratch buffers - allocated once, reused by every probe.
    _probe: makeAABB(),
    _hits: new Int32Array(24),
  };
}

export function clearAffordances(a) {
  a.vaultValid = false; a.vaultIndex = -1;
  a.blockerValid = false; a.blockerIndex = -1;
  a.slideNeeded = false; a.slideIndex = -1;
  a.ceilingBlocked = false;
  a.wallLeftValid = false; a.wallLeftIndex = -1;
  a.wallRightValid = false; a.wallRightIndex = -1;
  a.wallNearLeft = false; a.wallNearRight = false;
  a.ledgeValid = false; a.ledgeIndex = -1;
  a.railValid = false; a.railIndex = -1;
  a.launchValid = false; a.launchIndex = -1;
  a.hazardTouch = false; a.hazardIndex = -1;
  a.gapDistance = 0;
}

/**
 * Fills `a` from the world around a body at (x, y, z) moving at `speed`.
 *
 * @param {object} a       the affordance set to fill
 * @param {object} world   { cs, candidates, candidateCount }
 */
export function sense(a, world, x, y, z, speed, height) {
  const { cs, candidates, candidateCount: n } = world;
  clearAffordances(a);

  const hx = BODY.halfX;
  const hz = BODY.halfZ;

  // --- Ground -------------------------------------------------------------
  groundProbe(x, y + 0.05, z, hx, hz, PARKOUR.fallDeathDepth > 0
    ? 0.45 : 0.45, cs, candidates, n, a.ground);

  // --- Forward obstacles ---------------------------------------------------
  // One probe covering the full body height, then classify each hit by how tall
  // it is relative to the runner. One query, three answers.
  const reach = PARKOUR.vaultMaxDepth;
  const probe = a._probe;
  setBoxAABB(probe, x - hx, y + 0.05, z + hz, x + hx, y + height, z + hz + reach);
  let m = overlapBox(probe, cs, candidates, n, SOLIDS, a._hits);

  let bestVault = -1, bestVaultTop = 0, bestVaultExit = 0;
  let bestBlocker = -1;
  for (let k = 0; k < m; k++) {
    const i = a._hits[k];
    if (cs.kind[i] === KIND.RAMP) continue;
    const top = cs.maxY[i];
    const relTop = top - y;
    if (relTop <= PARKOUR.vaultMaxTop && relTop >= PARKOUR.vaultMinTop) {
      // Vaultable only when there is headroom to actually pass over it.
      if (bestVault < 0 || cs.minZ[i] < cs.minZ[bestVault]) {
        bestVault = i;
        bestVaultTop = top;
        bestVaultExit = cs.maxZ[i];
      }
    } else if (relTop > PARKOUR.vaultMaxTop) {
      // Tall obstacle. It is only a blocker if it also occupies the low band -
      // an overhang with clear space underneath is a slide, not a wall.
      if (cs.minY[i] <= y + BODY.slideHeight * 0.9) {
        if (bestBlocker < 0 || cs.minZ[i] < cs.minZ[bestBlocker]) bestBlocker = i;
      } else if (cs.minY[i] < y + BODY.height) {
        a.slideNeeded = true;
        if (a.slideIndex < 0 || cs.minZ[i] < cs.minZ[a.slideIndex]) a.slideIndex = i;
      }
    }
  }
  if (bestVault >= 0) {
    a.vaultValid = speed >= PARKOUR.vaultMinSpeed;
    a.vaultIndex = bestVault;
    a.vaultTop = bestVaultTop;
    a.vaultExitZ = bestVaultExit;
  }
  if (bestBlocker >= 0) {
    a.blockerValid = true;
    a.blockerIndex = bestBlocker;
  }

  // --- Headroom ------------------------------------------------------------
  // The slab of space a crouched body would sweep through on standing up. If
  // anything is in it, standing up would leave the body inside geometry - which
  // is unrecoverable, so the slide has to continue instead.
  setBoxAABB(probe, x - hx, y + BODY.slideHeight + 0.02, z - hz,
    x + hx, y + BODY.height, z + hz);
  a.ceilingBlocked = overlapBox(probe, cs, candidates, n, SOLIDS, a._hits) > 0;

  // --- Side walls ----------------------------------------------------------
  const wallBandLow = y + 0.4;
  const wallBandHigh = y + 1.6;
  const reachSide = PARKOUR.wallMaxDistance;

  setBoxAABB(probe, x - hx - reachSide, wallBandLow, z - hz,
    x - hx, wallBandHigh, z + hz + 0.4);
  m = overlapBox(probe, cs, candidates, n, WALLS, a._hits);
  for (let k = 0; k < m; k++) {
    const i = a._hits[k];
    if ((cs.flags[i] & FLAG.NO_WALLRUN) !== 0) continue;
    if (cs.maxY[i] - cs.minY[i] < PARKOUR.wallMinHeight) continue;
    a.wallLeftValid = true;
    a.wallLeftIndex = i;
    a.wallLeftX = cs.maxX[i];
    break;
  }

  setBoxAABB(probe, x + hx, wallBandLow, z - hz,
    x + hx + reachSide, wallBandHigh, z + hz + 0.4);
  m = overlapBox(probe, cs, candidates, n, WALLS, a._hits);
  for (let k = 0; k < m; k++) {
    const i = a._hits[k];
    if ((cs.flags[i] & FLAG.NO_WALLRUN) !== 0) continue;
    if (cs.maxY[i] - cs.minY[i] < PARKOUR.wallMinHeight) continue;
    a.wallRightValid = true;
    a.wallRightIndex = i;
    a.wallRightX = cs.minX[i];
    break;
  }

  // --- Walls within reach, looking further ahead ---------------------------
  // Deliberately much wider and longer than the adjacency probes: this answers
  // "is there a wall I could get to", not "am I on one".
  const nearReach = 3.4;
  const nearAhead = 7;

  setBoxAABB(probe, x - hx - nearReach, wallBandLow, z + hz,
    x - hx, wallBandHigh, z + hz + nearAhead);
  m = overlapBox(probe, cs, candidates, n, WALLS, a._hits);
  for (let k = 0; k < m; k++) {
    const i = a._hits[k];
    if ((cs.flags[i] & FLAG.NO_WALLRUN) !== 0) continue;
    if (cs.maxY[i] - cs.minY[i] < PARKOUR.wallMinHeight) continue;
    a.wallNearLeft = true;
    break;
  }

  setBoxAABB(probe, x + hx, wallBandLow, z + hz,
    x + hx + nearReach, wallBandHigh, z + hz + nearAhead);
  m = overlapBox(probe, cs, candidates, n, WALLS, a._hits);
  for (let k = 0; k < m; k++) {
    const i = a._hits[k];
    if ((cs.flags[i] & FLAG.NO_WALLRUN) !== 0) continue;
    if (cs.maxY[i] - cs.minY[i] < PARKOUR.wallMinHeight) continue;
    a.wallNearRight = true;
    break;
  }

  // --- Ledge ---------------------------------------------------------------
  // A grabbable edge is a top face near head height with nothing above it.
  setBoxAABB(probe, x - hx, y + height * 0.55, z + hz,
    x + hx, y + height + 0.5, z + hz + PARKOUR.ledgeMaxReach + 0.3);
  m = overlapBox(probe, cs, candidates, n, SOLIDS, a._hits);
  for (let k = 0; k < m; k++) {
    const i = a._hits[k];
    const top = cs.maxY[i];
    if (top > y + height + 0.5 || top < y + height * 0.5) continue;
    // Headroom check: is the space above the edge clear enough to stand?
    setBoxAABB(probe, x - hx, top + 0.05, cs.minZ[i] + 0.05,
      x + hx, top + BODY.height * 0.9, cs.maxZ[i] - 0.05);
    if (overlapBox(probe, cs, candidates, n, SOLIDS, a._hits) === 0) {
      a.ledgeValid = true;
      a.ledgeIndex = i;
      a.ledgeY = top;
      break;
    }
  }

  // --- Gap ahead -----------------------------------------------------------
  const look = Math.max(3, speed * 0.65);
  a.gapDistance = gapAhead(x, y, z, look, hx, cs, candidates, n);

  // --- Rails ---------------------------------------------------------------
  setBoxAABB(probe, x - hx, y - 0.6, z + hz, x + hx, y + 1.0, z + hz + PARKOUR.railEntryDistance);
  m = overlapBox(probe, cs, candidates, n, RAILS, a._hits);
  if (m > 0) {
    a.railValid = true;
    a.railIndex = a._hits[0];
    a.railY = cs.maxY[a._hits[0]];
  }

  // --- Launch pads and hazards under the feet ------------------------------
  if (a.ground.hit) {
    const gi = a.ground.index;
    if ((cs.flags[gi] & FLAG.BOOST) !== 0) {
      a.launchValid = true;
      a.launchIndex = gi;
    }
  }

  setBoxAABB(probe, x - hx, y, z - hz, x + hx, y + height, z + hz);
  m = overlapBox(probe, cs, candidates, n, 0, a._hits);
  for (let k = 0; k < m; k++) {
    const i = a._hits[k];
    if ((cs.flags[i] & FLAG.HAZARD) !== 0) {
      a.hazardTouch = true;
      a.hazardIndex = i;
      break;
    }
  }

  return a;
}
