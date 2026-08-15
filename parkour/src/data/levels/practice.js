/**
 * The practice track.
 *
 * A hand-built course that introduces every move once, in the order the tutorial
 * teaches them, with flat running between beats so each one is legible on its
 * own. It is the track the movement tuning pass is judged against, and the one
 * the browser smoke test drives.
 *
 * Pure data assembled through LevelBuilder - no three.js, no randomness.
 */
import { KIND, FLAG, SURFACE } from '../../config.js';
import { LevelBuilder } from '../../sim/level/builder.js';

/** Inner walls sit inside the lane clamp so they are actually reachable. */
function runnableWall(b, side, z0, z1, opts = {}) {
  const inner = side < 0 ? -2.9 : 2.9;
  const outer = inner + side * 0.7;
  return b.box(Math.min(inner, outer), 0, z0, Math.max(inner, outer), 6, z1, {
    kind: KIND.WALLRUNNABLE, surface: SURFACE.CONCRETE, ...opts,
  });
}

export function buildPracticeLevel() {
  const b = new LevelBuilder({
    levelId: 'practice',
    theme: 'rooftops',
    startZ: 0,
    floorY: -30,
    speedCurve: { start: 9, base: 13, max: 17, accelPerSec: 0.2 },
  });

  // --- 0-40: open running, find your feet ---------------------------------
  b.section(-12, 40, -30);
  b.floor(-12, 40, 0);
  b.wall(-1, -12, 40);
  b.wall(1, -12, 40);
  for (let z = 12; z < 36; z += 4) b.coin(0, 1.2, z);

  // --- 40-80: vaults ------------------------------------------------------
  b.section(40, 80, -30);
  b.floor(40, 80, 0);
  b.wall(-1, 40, 80);
  b.wall(1, 40, 80);
  b.vaultBox(48, 0, 0.9);
  b.vaultBox(60, 0, 0.7);
  b.vaultBox(72, 0, 1.0, 1.0);
  b.coin(0, 1.6, 49);
  b.coin(0, 1.6, 61);
  b.checkpoint(78);

  // --- 80-120: slides -----------------------------------------------------
  b.section(80, 120, -30);
  b.floor(80, 120, 0);
  b.wall(-1, 80, 120);
  b.wall(1, 80, 120);
  b.slideBar(90, 0, 0.95);
  b.slideBar(104, 0, 0.9, 2.0);
  for (let z = 91; z < 96; z += 1.5) b.coin(0, 0.5, z);

  // --- 120-165: gaps, so the jump has to mean something -------------------
  b.section(120, 165, -30);
  b.floor(120, 134, 0);
  b.floor(140, 152, 0);
  b.floor(158, 165, 0);
  b.wall(-1, 120, 165);
  b.wall(1, 120, 165);
  b.coin(0, 2.4, 137);
  b.coin(0, 2.4, 155);
  b.checkpoint(163);

  // --- 165-210: wall-run ---------------------------------------------------
  b.section(165, 210, -30);
  b.floor(165, 210, 0);
  b.wall(1, 165, 210);
  // A hole in the floor with a runnable wall beside it: the wall is the route.
  b.box(-5, -1, 178, 5, 0, 196, { kind: KIND.SOLID, flags: FLAG.HAZARD });
  runnableWall(b, -1, 174, 200);
  for (let z = 180; z < 194; z += 3) b.coin(-2.2, 2.6, z);

  // --- 210-250: ledge mantle ----------------------------------------------
  b.section(210, 250, -30);
  b.floor(210, 224, 0);
  b.box(-5, -1.5, 229, 5, 1.5, 250, { kind: KIND.SOLID, surface: SURFACE.CONCRETE });
  b.wall(-1, 210, 250, 1.5);
  b.wall(1, 210, 250, 1.5);
  b.coin(0, 2.6, 236);
  b.checkpoint(246, 0, 1.5);

  // --- 250-290: launch pad and a descent -----------------------------------
  b.section(250, 292, -30);
  b.box(-5, 0.5, 250, 5, 1.5, 262, { kind: KIND.SOLID });
  b.box(-1.7, 1.5, 262, 1.7, 1.58, 263.6, {
    kind: KIND.SOLID, flags: FLAG.BOOST, surface: SURFACE.METAL,
  });
  b.box(-5, 0.5, 263.6, 5, 1.5, 272, { kind: KIND.SOLID });
  b.ramp(272, 282, 1.5, 0, 5, true);
  b.floor(282, 292, 0);
  b.wall(-1, 250, 292, 0);
  b.wall(1, 250, 292, 0);
  b.coin(0, 3.4, 266);
  b.coin(0, 3.0, 268);

  // --- 292-330: everything at once, then the line -------------------------
  b.section(292, 340, -30);
  b.floor(292, 340, 0);
  b.wall(-1, 292, 340);
  b.wall(1, 292, 340);
  b.vaultBox(300, 0, 0.85);
  b.slideBar(312, 0, 0.95);
  b.speedStrip(320, 4);
  b.movingPlatform(-2, 0, 328, 4, 1, 4, { x: 1 }, 2.2, 3.5);
  b.finish(336);

  return b.build();
}
