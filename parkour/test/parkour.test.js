/**
 * Parkour moves, each in its own synthetic mini-world.
 *
 * The negative cases carry as much weight as the positive ones. A vault that
 * fires when the runner is too slow, or a mantle that fires into a ceiling, is
 * worse than one that never fires - it teaches the player a rule the game then
 * breaks. So every "this should happen" here is paired with the case where it
 * must not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { KIND, FLAG, SURFACE, BODY, PARKOUR, MOVEMENT } from '../src/config.js';
import { LevelBuilder } from '../src/sim/level/builder.js';
import { makeRig, STATE, stateName, EV } from '../src/sim/testing/rig.js';

/** Slow, flat speed curve so a test can hold the runner below a threshold. */
function curve(v) {
  return { start: v, base: v, max: v, accelPerSec: 0 };
}

function track(opts = {}) {
  const b = new LevelBuilder({ levelId: 'parkour-fixture', ...opts });
  b.floor(-10, 200, 0);
  b.section(-10, 260, -30);
  b.finishZ = 190;
  return b;
}

/**
 * A wall close enough to the lane to actually be reachable. `LevelBuilder.wall`
 * places the boundary walls of a full-width track, which sit outside the lane
 * clamp by design - a wall-run wall has to be inside it.
 */
function innerWall(b, side, z0, z1, opts = {}) {
  const inner = side < 0 ? -2.9 : 2.9;
  const outer = inner + side * 0.6;
  return b.box(Math.min(inner, outer), 0, z0, Math.max(inner, outer), 6, z1, {
    kind: KIND.WALLRUNNABLE, ...opts,
  });
}

const run = (intent) => { intent.jumpHeld = false; };

/**
 * Runs the fixed approach-and-jump script that puts the runner on a left wall,
 * and leaves it mid-wall-run. The script is index-driven, so it has to be one
 * `step` call - the substep index a rig hands the intent callback is relative to
 * that call.
 */
function enterWallRun(rig, jumpAt = 30) {
  // The jump goes in before the wall's Z range; the latch happens on arrival a
  // dozen substeps later, well inside the wall-run's 1.4 s cap.
  rig.step(jumpAt + 20, (intent, i) => {
    intent.lateralTarget = -1;
    intent.jumpPressed = i === jumpAt;
    intent.jumpHeld = i >= jumpAt && i < jumpAt + 15;
  });
  return rig.p.state === STATE.WALLRUN;
}

// --- Vault ------------------------------------------------------------------

test('a low obstacle at speed is vaulted, not crashed into', () => {
  const b = track();
  b.vaultBox(40, 0, 0.9);
  const rig = makeRig(b.build(), { speed: 12, z: 30 });
  const p = rig.p;

  rig.run(3, run);

  assert.equal(rig.countOf(EV.VAULT), 1, 'the vault never fired');
  assert.equal(rig.countOf(EV.CRASH), 0, 'vaulting must not also register a crash');
  assert.ok(p.pos.z > 42, `runner stalled at z=${p.pos.z.toFixed(2)} instead of clearing the box`);
});

test('a vault preserves forward speed', () => {
  const b = track();
  b.vaultBox(40, 0, 0.9);
  const rig = makeRig(b.build(), { speed: 12, z: 30 });
  const p = rig.p;

  rig.stepUntil((r) => r.state === STATE.VAULT, 300, run);
  const entrySpeed = p.speed;
  rig.run(1, run);

  assert.ok(entrySpeed > 0, 'never entered the vault');
  assert.ok(p.speed >= entrySpeed * 0.95,
    `speed fell from ${entrySpeed.toFixed(2)} to ${p.speed.toFixed(2)} across the vault`);
});

test('too slow to vault is a crash, not a free pass', () => {
  const b = track({ speedCurve: curve(4) });
  b.vaultBox(40, 0, 0.9);
  const rig = makeRig(b.build(), { speed: 4, z: 34 });
  const p = rig.p;

  rig.run(4, run);

  assert.ok(p.speed < PARKOUR.vaultMinSpeed, 'the fixture failed to hold the runner below vault speed');
  assert.equal(rig.countOf(EV.VAULT), 0, 'vaulted below the minimum speed');
  assert.ok(rig.countOf(EV.CRASH) >= 1, 'running into an unvaultable box should crash');
});

// --- Slide ------------------------------------------------------------------

test('sliding gets the runner under a low overhang', () => {
  const b = track();
  b.slideBar(40, 0, 0.95);
  const rig = makeRig(b.build(), { speed: 12, z: 30 });
  const p = rig.p;

  rig.run(3, (intent) => {
    intent.slidePressed = p.affordances.slideNeeded && p.grounded;
    intent.slideHeld = p.affordances.slideNeeded;
  });

  assert.ok(rig.countOf(EV.SLIDE_START) >= 1, 'the slide never started');
  assert.equal(rig.countOf(EV.CRASH), 0, 'the slide should have cleared the overhang');
  assert.ok(p.pos.z > 42, `runner stopped at z=${p.pos.z.toFixed(2)} under the bar`);
});

test('the same overhang without a slide input is a crash', () => {
  const b = track();
  b.slideBar(40, 0, 0.95);
  const rig = makeRig(b.build(), { speed: 12, z: 30 });

  rig.run(3, run);

  assert.equal(rig.countOf(EV.SLIDE_START), 0, 'a slide is a hard action and needs input');
  assert.ok(rig.countOf(EV.CRASH) >= 1, 'standing into an overhang should crash');
});

test('a slide lowers the body and then restores it', () => {
  const b = track();
  b.slideBar(40, 0, 0.95);
  const rig = makeRig(b.build(), { speed: 12, z: 30 });
  const p = rig.p;

  assert.notEqual(rig.stepUntil((r) => r.state === STATE.SLIDE, 300, (intent) => {
    intent.slidePressed = p.affordances.slideNeeded && p.grounded;
  }), -1, 'never entered the slide');

  assert.ok(PARKOUR.slideDuration > 0);
  assert.equal(BODY.slideHeight < BODY.height, true);

  rig.run(2, run);
  assert.notEqual(p.state, STATE.SLIDE, 'the slide never ended');
  assert.ok(rig.countOf(EV.SLIDE_END) >= 1);
});

// --- Wall-run ---------------------------------------------------------------

test('steering into a wall while airborne starts a wall-run', () => {
  const b = track();
  innerWall(b, -1, 30, 90);
  const rig = makeRig(b.build(), { speed: 14, z: 20 });
  const p = rig.p;

  rig.run(4, (intent, i) => {
    intent.lateralTarget = -1;
    intent.jumpPressed = i === 30;
    intent.jumpHeld = i >= 30 && i < 45;
  });

  assert.ok(rig.countOf(EV.WALLRUN_START) >= 1, 'never latched onto the wall');
  const start = rig.events(EV.WALLRUN_START)[0];
  assert.equal(start.a, -1, 'latched onto the wrong side');
});

test('a wall-run times out rather than lasting forever', () => {
  const b = track();
  innerWall(b, -1, 30, 160);
  const rig = makeRig(b.build(), { speed: 14, z: 20 });
  const p = rig.p;

  assert.ok(enterWallRun(rig), 'never entered the wall-run');

  let maxStateTime = 0;
  rig.run(3, (intent) => {
    intent.lateralTarget = -1;
    if (p.state === STATE.WALLRUN) maxStateTime = Math.max(maxStateTime, p.stateTime);
  });

  assert.ok(rig.countOf(EV.WALLRUN_END) >= 1, 'the wall-run never ended');
  assert.ok(maxStateTime <= PARKOUR.wallRunMaxTime + 1e-6,
    `wall-run ran ${maxStateTime.toFixed(3)} s, cap is ${PARKOUR.wallRunMaxTime}`);
  assert.notEqual(p.state, STATE.WALLRUN);
});

test('a wall flagged no-wallrun is never latched onto', () => {
  const b = track();
  innerWall(b, -1, 30, 90, { flags: FLAG.NO_WALLRUN });
  const rig = makeRig(b.build(), { speed: 14, z: 20 });

  rig.run(4, (intent, i) => {
    intent.lateralTarget = -1;
    intent.jumpPressed = i === 30;
    intent.jumpHeld = i >= 30 && i < 45;
  });

  assert.equal(rig.countOf(EV.WALLRUN_START), 0, 'latched onto a wall marked unrunnable');
});

test('a wall-jump pushes up and away from the wall', () => {
  const b = track();
  innerWall(b, -1, 30, 160);
  const rig = makeRig(b.build(), { speed: 14, z: 20 });
  const p = rig.p;

  assert.ok(enterWallRun(rig), 'never entered the wall-run');

  rig.clearLog();
  rig.step(1, (intent) => { intent.lateralTarget = -1; intent.jumpPressed = true; });

  assert.equal(rig.countOf(EV.WALL_JUMP), 1, 'the wall-jump never fired');
  assert.equal(p.vel.y, PARKOUR.wallJumpUp, 'wall-jump should apply its full upward impulse');
  assert.ok(p.vel.x > 0,
    `wall was on the left, so the push should be to the right (vel.x=${p.vel.x.toFixed(2)})`);
  assert.equal(Math.abs(p.vel.x), PARKOUR.wallJumpLateral);
});

// --- Ledge mantle -----------------------------------------------------------

/** Floor, a gap, then a raised deck whose lip sits at `deckY`. */
function mantleTrack(deckY = 1.5, ceiling = false) {
  const b = new LevelBuilder({ levelId: 'mantle' });
  b.floor(-10, 24, 0);
  b.box(-5, deckY - 3, 28, 5, deckY, 120, { kind: KIND.SOLID, surface: SURFACE.CONCRETE });
  if (ceiling) {
    // A slab low over the deck: there is an edge, but nowhere to stand up.
    b.box(-5, deckY + 0.6, 28, 5, deckY + 3.5, 120, { kind: KIND.SOLID });
  }
  b.section(-10, 160, -30);
  b.finishZ = 110;
  return b.build();
}

test('a ledge at head height is mantled on the way down', () => {
  const rig = makeRig(mantleTrack(), { speed: 13, z: 16 });
  const p = rig.p;

  rig.run(4, (intent, i) => {
    intent.jumpPressed = i === 20;
    intent.jumpHeld = i >= 20 && i < 34;
  });

  assert.equal(rig.countOf(EV.MANTLE), 1, 'never mantled the deck');
  assert.ok(p.pos.z > 30, `did not get onto the deck (z=${p.pos.z.toFixed(2)})`);
  assert.ok(p.pos.y > 1.4, `ended below the deck top (y=${p.pos.y.toFixed(2)})`);
  assert.equal(rig.countOf(EV.DEATH), 0, 'fell to its death instead of mantling');
});

test('a ledge with no headroom above it is not mantled', () => {
  const rig = makeRig(mantleTrack(1.5, true), { speed: 13, z: 16 });

  rig.run(4, (intent, i) => {
    intent.jumpPressed = i === 20;
    intent.jumpHeld = i >= 20 && i < 34;
  });

  assert.equal(rig.countOf(EV.MANTLE), 0,
    'mantled into a ceiling - the headroom check did not hold');
});

// --- Launch pad -------------------------------------------------------------

test('a launch pad throws the runner up with no input at all', () => {
  const b = track();
  // Sit the pad a hair proud of the floor so it wins the ground probe.
  b.box(-1.6, 0, 40, 1.6, 0.05, 41.4, {
    kind: KIND.SOLID, flags: FLAG.BOOST, surface: SURFACE.METAL,
  });
  const rig = makeRig(b.build(), { speed: 12, z: 30 });
  const p = rig.p;

  let apex = -Infinity;
  rig.run(3, (intent) => { if (p.pos.y > apex) apex = p.pos.y; });

  assert.equal(rig.countOf(EV.LAUNCH_PAD), 1, 'the pad never fired');
  assert.equal(rig.countOf(EV.JUMP), 0, 'a pad is not a jump and must not report one');
  // A pad throws harder than the runner's own jump - that is the whole point.
  assert.ok(apex > 2.2, `pad apex ${apex.toFixed(2)} is no higher than a normal jump`);
});

// --- Invariants across the whole move set -----------------------------------

test('no parkour move leaves the racer in a broken state', () => {
  const b = track();
  b.vaultBox(40, 0, 0.9);
  b.slideBar(60, 0, 0.95);
  innerWall(b, -1, 80, 130);
  b.box(-1.6, 0, 140, 1.6, 0.05, 141.4, { kind: KIND.SOLID, flags: FLAG.BOOST });
  const rig = makeRig(b.build(), { speed: 12, z: 20 });
  const p = rig.p;

  rig.run(12, (intent, i) => {
    intent.lateralTarget = Math.sin(i * 0.07);
    intent.jumpPressed = i % 23 === 0;
    intent.jumpHeld = i % 23 < 10;
    intent.slidePressed = p.affordances.slideNeeded && p.grounded;
    intent.slideHeld = p.affordances.slideNeeded;

    assert.ok(Number.isInteger(p.state) && p.state >= 0 && p.state < 17,
      `state escaped the table: ${p.state}`);
    assert.ok(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y) && Number.isFinite(p.pos.z),
      `position went non-finite in state ${stateName(p.state)}`);
    assert.ok(Number.isFinite(p.speed) && p.speed >= 0 && p.speed <= MOVEMENT.speedMax + 1,
      `speed left its range: ${p.speed}`);
  });

  assert.ok(p.pos.z > 100, `made almost no progress (z=${p.pos.z.toFixed(1)})`);
});
