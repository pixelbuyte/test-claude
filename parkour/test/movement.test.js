/**
 * Movement feel, pinned to numbers.
 *
 * Every assertion here is either an analytic value from config.js or a promise
 * the design makes to the player ("a late input still jumps"). Retuning a
 * constant should either keep these green or fail them loudly - what it must
 * never do is quietly change how the game plays.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { STEP, MOVEMENT, apexHeight } from '../src/config.js';
import { LevelBuilder } from '../src/sim/level/builder.js';
import { makeRig, STATE, EV } from '../src/sim/testing/rig.js';

/** A flat corridor with nothing on it. */
function flatTrack(opts = {}) {
  const b = new LevelBuilder({ levelId: 'flat', ...opts });
  b.floor(-10, 400, 0);
  b.section(-10, 400, -30);
  b.finishZ = 380;
  return b.build();
}

/** Floor that stops at `edgeZ`, so the runner can step off into nothing. */
function ledgeTrack(edgeZ = 30) {
  const b = new LevelBuilder({ levelId: 'ledge' });
  b.floor(-10, edgeZ, 0);
  b.section(-10, 400, -30);
  b.finishZ = 380;
  return b.build();
}

const holdJump = (intent) => { intent.jumpHeld = true; };

/** Runs a jump from standing and returns the peak height reached. */
function jumpApex(rig, { holdSteps = 60, steps = 90 } = {}) {
  let apex = -Infinity;
  rig.step(steps, (intent, i) => {
    intent.jumpPressed = i === 0;
    intent.jumpHeld = i < holdSteps;
    if (rig.p.pos.y > apex) apex = rig.p.pos.y;
  });
  // The loop samples before the substep runs, so take one final reading.
  return Math.max(apex, rig.p.pos.y);
}

test('a held jump reaches the analytic apex height', () => {
  const rig = makeRig(flatTrack(), { speed: 0, z: 0 });
  const apex = jumpApex(rig);

  // Semi-implicit Euler overshoots the closed-form solution slightly; what
  // matters is that the level validator's apexHeight() is honest about what the
  // runner can actually reach.
  assert.ok(apex >= apexHeight(), `apex ${apex.toFixed(3)} < analytic ${apexHeight().toFixed(3)}`);
  assert.ok(apex - apexHeight() < 0.12,
    `apex ${apex.toFixed(3)} drifts too far from analytic ${apexHeight().toFixed(3)}`);
  assert.equal(rig.countOf(EV.JUMP), 1);
});

test('gravity is asymmetric: floaty up, snappy down', () => {
  const rig = makeRig(flatTrack(), { speed: 0 });
  const p = rig.p;

  let riseTicks = 0;
  let fallTicks = 0;
  let peaked = false;
  rig.step(120, (intent, i) => {
    intent.jumpPressed = i === 0;
    intent.jumpHeld = true;
    if (p.state === STATE.JUMP || p.state === STATE.FALL) {
      if (p.vel.y > 0 && !peaked) riseTicks++;
      else { peaked = true; if (!p.grounded) fallTicks++; }
    }
  });

  assert.ok(riseTicks > 0 && fallTicks > 0, 'never left the ground');
  assert.ok(fallTicks < riseTicks,
    `descent (${fallTicks} ticks) should be quicker than ascent (${riseTicks} ticks)`);
});

test('releasing jump early cuts the arc short', () => {
  const held = jumpApex(makeRig(flatTrack(), { speed: 0 }));
  const cut = jumpApex(makeRig(flatTrack(), { speed: 0 }), { holdSteps: 3 });

  assert.ok(cut < held, `cut apex ${cut.toFixed(3)} should be below held apex ${held.toFixed(3)}`);
  // Cutting scales the remaining upward velocity, so the loss is large and
  // obvious rather than a subtle nudge.
  assert.ok(cut < held * 0.7,
    `cut apex ${cut.toFixed(3)} is barely lower than held ${held.toFixed(3)}`);
});

test('coyote time accepts a jump 0.11 s after leaving the ground', () => {
  const rig = makeRig(ledgeTrack(), { speed: 10, z: 24 });
  const p = rig.p;

  assert.notEqual(rig.stepUntil((r) => !r.grounded, 300, holdJump), -1, 'never left the ledge');
  rig.clearLog();

  const lateBy = Math.round(0.11 / STEP);
  rig.step(lateBy + 12, (intent, i) => {
    intent.jumpPressed = i === lateBy - 1;
    intent.jumpHeld = true;
  });

  assert.equal(rig.countOf(EV.JUMP), 1, 'a jump 0.11 s late should still be a ground jump');
  assert.equal(rig.countOf(EV.DOUBLE_JUMP), 0);
  assert.ok(p.vel.y > 0 || p.pos.y > 0.5, 'the jump produced no upward motion');
});

test('coyote time rejects a jump 0.13 s after leaving the ground', () => {
  const rig = makeRig(ledgeTrack(), { speed: 10, z: 24 });

  assert.notEqual(rig.stepUntil((r) => !r.grounded, 300, holdJump), -1, 'never left the ledge');
  rig.clearLog();

  const lateBy = Math.round(0.13 / STEP);
  rig.step(lateBy + 12, (intent, i) => {
    intent.jumpPressed = i === lateBy - 1;
    intent.jumpHeld = true;
  });

  // Past the window it is no longer a ground jump. It becomes the air move it
  // actually is - which is the honest outcome, not a silent no-op.
  assert.equal(rig.countOf(EV.JUMP), 0, 'a jump 0.13 s late must not count as a ground jump');
  assert.equal(rig.countOf(EV.DOUBLE_JUMP), 1);
});

test('a jump pressed just before landing is buffered and fires on touchdown', () => {
  // First pass: find out when the runner actually lands.
  const probe = makeRig(flatTrack(), { speed: 0 });
  probe.step(1, (intent) => { intent.jumpPressed = true; intent.jumpHeld = true; });
  const airborneUntilLand = probe.stepUntil((r) => r.grounded, 200, holdJump);
  assert.notEqual(airborneUntilLand, -1, 'never came back down');

  const press = (offsetTicks) => {
    const rig = makeRig(flatTrack(), { speed: 0 });
    const p = rig.p;
    rig.step(1, (intent) => { intent.jumpPressed = true; intent.jumpHeld = true; });
    // Spend the double jump so the buffer, not the air move, is under test.
    p.canDoubleJump = false;
    rig.clearLog();
    rig.step(airborneUntilLand + 20, (intent, i) => {
      intent.jumpPressed = i === airborneUntilLand - offsetTicks;
      intent.jumpHeld = true;
    });
    return rig;
  };

  const buffered = press(Math.round(0.10 / STEP));
  assert.equal(buffered.countOf(EV.JUMP), 1,
    'a press 0.10 s before landing should be buffered into a jump');

  const tooEarly = press(Math.round(0.35 / STEP));
  assert.equal(tooEarly.countOf(EV.JUMP), 0,
    'a press 0.35 s before landing is well outside the buffer and must expire');
});

test('double jump fires once per airtime and resets on landing', () => {
  const rig = makeRig(flatTrack(), { speed: 0 });
  const p = rig.p;

  // Ground jump, then two air presses - only the first may take.
  rig.step(1, (intent) => { intent.jumpPressed = true; intent.jumpHeld = true; });
  rig.step(6, holdJump);
  rig.step(1, (intent) => { intent.jumpPressed = true; intent.jumpHeld = true; });
  rig.step(6, holdJump);
  rig.step(1, (intent) => { intent.jumpPressed = true; intent.jumpHeld = true; });

  assert.equal(rig.countOf(EV.JUMP), 1);
  assert.equal(rig.countOf(EV.DOUBLE_JUMP), 1, 'the second air press must be ignored');

  // Land, then the air move is available again. Ground contact is established
  // during resolution, so the flag is refreshed at the top of the next substep's
  // decision pass - still before any input that substep is consulted.
  assert.notEqual(rig.stepUntil((r) => r.grounded, 300, holdJump), -1, 'never landed');
  rig.step(1, holdJump);
  assert.equal(p.canDoubleJump, true, 'landing must restore the double jump');

  rig.clearLog();
  rig.step(1, (intent) => { intent.jumpPressed = true; intent.jumpHeld = true; });
  rig.step(6, holdJump);
  rig.step(1, (intent) => { intent.jumpPressed = true; intent.jumpHeld = true; });
  assert.equal(rig.countOf(EV.DOUBLE_JUMP), 1, 'double jump should be available after landing');
});

test('exactly one land event per landing', () => {
  const rig = makeRig(flatTrack(), { speed: 0 });

  rig.step(1, (intent) => { intent.jumpPressed = true; intent.jumpHeld = true; });
  rig.run(2.5, holdJump);

  assert.equal(rig.countOf(EV.LAND), 1,
    'ground snapping must not chatter the land event on touchdown');
  assert.equal(rig.p.grounded, true);
});

test('forward speed converges on the course speed curve', () => {
  const level = flatTrack({ speedCurve: { start: 9, base: 14, max: 14, accelPerSec: 0 } });
  const rig = makeRig(level, { speed: 0 });
  const p = rig.p;

  rig.run(4);

  const target = rig.world.baseSpeedAt(p.pos.z);
  assert.ok(Math.abs(p.speed - target) < 0.5,
    `speed ${p.speed.toFixed(2)} never converged on target ${target.toFixed(2)}`);
  assert.ok(p.pos.z > 30, 'the runner barely moved');
});

test('the lane spring settles on target without overshooting', () => {
  const rig = makeRig(flatTrack(), { speed: 10 });
  const p = rig.p;

  let maxX = -Infinity;
  rig.run(1.5, (intent) => {
    intent.lateralTarget = 1;
    if (p.pos.x > maxX) maxX = p.pos.x;
  });

  const target = p.targetX;
  assert.ok(target > 2, `lateral target ${target} should be the outer lane`);
  assert.ok(maxX <= target + 0.01,
    `overshot the lane: reached ${maxX.toFixed(4)} past target ${target.toFixed(4)}`);
  assert.ok(Math.abs(p.pos.x - target) < 0.05,
    `never settled: x ${p.pos.x.toFixed(4)} vs target ${target.toFixed(4)}`);
});

test('lateral motion stays inside the track bounds', () => {
  const rig = makeRig(flatTrack(), { speed: 12 });
  const p = rig.p;

  // Slam the input from side to side; the body must never leave the lane span.
  rig.run(4, (intent, i) => {
    intent.lateralTarget = Math.floor(i / 10) % 2 === 0 ? -1 : 1;
    assert.ok(p.pos.x >= p.laneMinX - 0.01 && p.pos.x <= p.laneMaxX + 0.01,
      `x ${p.pos.x.toFixed(3)} escaped [${p.laneMinX}, ${p.laneMaxX}]`);
    assert.ok(Number.isFinite(p.pos.x) && Number.isFinite(p.vel.x), 'lateral state went non-finite');
  });
});

test('a jump carries forward momentum rather than stalling it', () => {
  const rig = makeRig(flatTrack(), { speed: 12 });
  const p = rig.p;

  const zBefore = p.pos.z;
  rig.step(1, (intent) => { intent.jumpPressed = true; intent.jumpHeld = true; });
  const airTicks = rig.stepUntil((r) => r.grounded, 300, holdJump);
  const travelled = p.pos.z - zBefore;

  assert.ok(airTicks > 20, 'the jump barely left the ground');
  assert.ok(travelled > airTicks * STEP * MOVEMENT.speedMin,
    `only travelled ${travelled.toFixed(2)} m over ${(airTicks * STEP).toFixed(2)} s of airtime`);
});
