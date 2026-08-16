/**
 * The chase camera.
 *
 * This file was promised in the plan and never written, which is how the
 * vertical follow stayed wrong for so long without anyone noticing: Y was
 * damped at exactly the same rate as X, so the camera tracked a jump almost
 * perfectly and the runner stayed pinned at one height in frame while the world
 * dropped around them. That is precisely why jumps read flat - you never see
 * the runner rise.
 *
 * Framing is pure numbers on purpose, so all of this is ordinary arithmetic
 * rather than something to eyeball at 60fps.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMERA, MOVEMENT, STEP } from '../src/config.js';
import {
  makeCamera, resetCamera, stepCamera, addShake, setAspectMode,
} from '../src/sim/camera/CameraController.js';
import { LevelBuilder } from '../src/sim/level/builder.js';
import { World } from '../src/sim/world/World.js';

/** A flat corridor with nothing to clip against. */
function emptyWorld() {
  const b = new LevelBuilder({ levelId: 'cam', theme: 'rooftops' });
  b.box(-5, -1, -20, 5, 0, 200, { kind: 0 });
  b.section(-20, 200, -30);
  return new World(b.build());
}

function racer(over = {}) {
  return {
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    speed: 12,
    grounded: true,
    affordances: null,
    ...over,
  };
}

test('the camera trails behind a rising runner instead of tracking them exactly', () => {
  const world = emptyWorld();

  const glued = makeCamera();
  const p1 = racer({ grounded: true });
  resetCamera(glued, p1);

  const airborne = makeCamera();
  const p2 = racer({ grounded: false });
  resetCamera(airborne, p2);

  // Same climb, one on the ground and one in the air.
  for (let i = 0; i < 30; i++) {
    p1.pos.y += 0.06; p1.pos.z += 0.2;
    p2.pos.y += 0.06; p2.pos.z += 0.2;
    stepCamera(glued, p1, world);
    stepCamera(airborne, p2, world);
  }

  const groundedGap = (p1.pos.y + CAMERA.height) - glued.pos.y;
  const airborneGap = (p2.pos.y + CAMERA.height) - airborne.pos.y;

  assert.ok(airborneGap > groundedGap,
    `airborne follow should lag more than grounded (${airborneGap} vs ${groundedGap})`);
  assert.ok(airborneGap > 0.05,
    'there is a visible gap, otherwise the runner is pinned in frame as before');
});

test('the trail is clamped, so a long fall never loses the runner off screen', () => {
  const world = emptyWorld();
  const cam = makeCamera();
  const p = racer({ grounded: false, pos: { x: 0, y: 40, z: 0 }, vel: { x: 0, y: 0, z: 0 } });
  resetCamera(cam, p);

  // Rocket upward far faster than the camera could ever follow.
  for (let i = 0; i < 120; i++) {
    p.pos.y += 0.9;
    stepCamera(cam, p, world);
    const trail = (p.pos.y + CAMERA.height) - cam.pos.y;
    assert.ok(trail <= CAMERA.maxVerticalTrail + 1e-6,
      `trail ${trail} exceeded the clamp at step ${i}`);
  }
});

test('landing tightens the follow back up', () => {
  const world = emptyWorld();
  const cam = makeCamera();
  const p = racer({ grounded: false, pos: { x: 0, y: 3, z: 0 } });
  resetCamera(cam, p);

  for (let i = 0; i < 40; i++) { p.pos.y += 0.05; stepCamera(cam, p, world); }
  const airGap = (p.pos.y + CAMERA.height) - cam.pos.y;

  p.grounded = true;
  for (let i = 0; i < 40; i++) stepCamera(cam, p, world);
  const groundGap = (p.pos.y + CAMERA.height) - cam.pos.y;

  assert.ok(Math.abs(groundGap) < Math.abs(airGap),
    'the camera closes the gap once the runner is back on the ground');
});

test('field of view rises monotonically with speed', () => {
  const world = emptyWorld();
  let previous = -Infinity;

  for (const speed of [0, 5, 10, 15, MOVEMENT.speedMax]) {
    const cam = makeCamera();
    const p = racer({ speed });
    resetCamera(cam, p);
    // Long enough for the damped FOV to settle.
    for (let i = 0; i < 400; i++) stepCamera(cam, p, world);
    assert.ok(cam.fov >= previous - 1e-6,
      `fov should not fall as speed rises: ${cam.fov} after ${previous}`);
    previous = cam.fov;
  }
});

test('portrait is wider than landscape, so the same course fits a taller screen', () => {
  const world = emptyWorld();
  const p = racer({ speed: 0 });

  const tall = makeCamera();
  resetCamera(tall, p);
  setAspectMode(tall, 400, 900);
  for (let i = 0; i < 400; i++) stepCamera(tall, p, world);

  const wide = makeCamera();
  resetCamera(wide, p);
  setAspectMode(wide, 900, 400);
  for (let i = 0; i < 400; i++) stepCamera(wide, p, world);

  assert.ok(tall.fov > wide.fov, `portrait ${tall.fov} should exceed landscape ${wide.fov}`);
});

test('shake decays to exactly zero rather than ringing forever', () => {
  const world = emptyWorld();
  const cam = makeCamera();
  const p = racer();
  resetCamera(cam, p);

  addShake(cam, CAMERA.shakeCrash);
  assert.ok(cam.shake > 0, 'shake was actually applied');

  for (let i = 0; i < Math.ceil(8 / STEP); i++) stepCamera(cam, p, world);

  assert.equal(cam.shake, 0, 'shake reaches zero, not merely a small number');
  assert.equal(cam.shakeOffsetX, 0);
  assert.equal(cam.shakeOffsetY, 0);
});

test('reduced motion means no shake at all, not quieter shake', () => {
  const world = emptyWorld();
  const cam = makeCamera();
  cam.allowShake = false;
  const p = racer();
  resetCamera(cam, p);

  addShake(cam, CAMERA.shakeCrash);
  for (let i = 0; i < 10; i++) stepCamera(cam, p, world);

  assert.equal(cam.shakeOffsetX, 0);
  assert.equal(cam.shakeOffsetY, 0);
});

test('the camera never resolves inside the level it is following through', () => {
  // A wall right behind the runner: the boom has to pull in rather than pass
  // through it. This is the assertion the plan named and never had.
  const b = new LevelBuilder({ levelId: 'clip', theme: 'rooftops' });
  b.box(-5, -1, -20, 5, 0, 200, { kind: 0 });
  b.box(-5, 0, -6, 5, 6, -5, { kind: 0 });       // slab behind the start
  b.section(-20, 200, -30);
  const world = new World(b.build());

  const cam = makeCamera();
  const p = racer({ pos: { x: 0, y: 0, z: 0 }, speed: 20 });
  resetCamera(cam, p);
  for (let i = 0; i < 200; i++) stepCamera(cam, p, world);

  // The slab spans z in [-6, -5]; a camera at the full boom would sit at about
  // z = -7.6, behind it.
  const insideSlab = cam.pos.z > -6 - CAMERA.clipRadius && cam.pos.z < -5 + CAMERA.clipRadius
    && cam.pos.y < 6;
  assert.equal(insideSlab, false, `camera resolved inside the blocker at z=${cam.pos.z}`);
  assert.ok(cam.boom >= 1.2, 'the boom never collapses past its floor');
});

test('portrait shows more of the course, not just a wider lens', () => {
  // Rotating the phone used to change nothing but FOV, so a tall screen got the
  // landscape framing stretched over it - a third of the frame was empty sky
  // and no more of the course was visible than in landscape.
  const world = emptyWorld();
  const p = racer({ speed: 14 });

  const tall = makeCamera();
  resetCamera(tall, p);
  setAspectMode(tall, 400, 900);
  for (let i = 0; i < 300; i++) stepCamera(tall, p, world);

  const wide = makeCamera();
  resetCamera(wide, p);
  setAspectMode(wide, 900, 400);
  for (let i = 0; i < 300; i++) stepCamera(wide, p, world);

  assert.ok(tall.pos.y > wide.pos.y,
    `portrait sits higher so it pitches down onto the track (${tall.pos.y} vs ${wide.pos.y})`);
  assert.ok(tall.pos.z < wide.pos.z,
    'portrait pulls further back, so the runner does not swell to fill a taller viewport');
});
