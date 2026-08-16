/**
 * The somersault.
 *
 * Worth its own file because the flip was blocked by two separate things that
 * no existing test could see, and both are the kind that come back:
 *
 *   1. `CharacterView.pose` wrote the body's orientation as `set(0, y, z)`,
 *      discarding the X channel. A flip is rotation about X, so no clip could
 *      ever produce one - the feature was impossible by construction rather
 *      than merely unwritten. That half lives in the view and is asserted here
 *      only as "the clip really does drive ROOT.x", which is what the view has
 *      to honour.
 *
 *   2. The animator is handed an interpolated *render proxy*, not the racer.
 *      The proxy is built field by field, so `canDoubleJump` was `undefined` on
 *      it and the selector's `=== false` never matched. Anything the animator
 *      reasons about has to be copied onto that proxy, and a missing field is
 *      silently undefined rather than an error - so the selector is pinned here
 *      against the exact shape the proxy has.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CLIPS } from '../src/data/anim/clips.js';
import { BONE } from '../src/data/anim/rig.js';
import { samplePose } from '../src/sim/anim/blend.js';
import { makePose } from '../src/data/anim/rig.js';
import { makeAnimator, stepAnimator } from '../src/sim/anim/AnimationController.js';
import { STATE } from '../src/sim/player/states.js';

const TAU = Math.PI * 2;

test('the flip clip carries a full turn on the root, not a partial one', () => {
  const clip = CLIPS.flip;
  assert.ok(clip, 'there is a flip clip');

  const track = clip.tracks.find((t) => t.bone === BONE.ROOT && t.axis === 0);
  assert.ok(track, 'the flip drives ROOT about X - the axis a somersault turns on');

  const start = makePose();
  const end = makePose();
  samplePose(clip, 0, start);
  samplePose(clip, 1, end);

  const o = BONE.ROOT * 3;
  assert.ok(Math.abs(start[o]) < 1e-6, 'starts upright');
  // Landing a rotation short reads far worse than not rotating at all, so this
  // is a full turn to within a degree rather than "roughly a turn".
  assert.ok(Math.abs(end[o] - TAU) < 0.02, `ends a full turn round, got ${end[o]}`);
});

test('the flip passes through halfway upside down', () => {
  const pose = makePose();
  samplePose(CLIPS.flip, 0.5, pose);
  const pitch = pose[BONE.ROOT * 3];
  // Somewhere in the second and third quarter turn: enough to prove the
  // rotation is monotonic through inversion rather than easing back out.
  assert.ok(pitch > Math.PI * 0.6 && pitch < Math.PI * 1.6,
    `midpoint pitch should be near inverted, got ${pitch}`);
});

/**
 * The exact shape `RaceSession` hands the animator. Built literally rather than
 * imported, so that dropping a field from the real proxy fails here.
 */
function renderProxy(over = {}) {
  return {
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    state: STATE.JUMP,
    grounded: false,
    speed: 12,
    canDoubleJump: true,
    ...over,
  };
}

test('a ground jump plays the jump, an air jump plays the flip', () => {
  const ground = makeAnimator();
  stepAnimator(ground, renderProxy({ canDoubleJump: true }), 1 / 60);
  assert.equal(ground.actionId, 'jumpUp', 'a first jump is an ordinary jump');

  const air = makeAnimator();
  stepAnimator(air, renderProxy({ canDoubleJump: false }), 1 / 60);
  assert.equal(air.actionId, 'flip', 'a spent air jump is a somersault');
});

test('a proxy missing canDoubleJump does not silently fall back to jumpUp', () => {
  // This is the bug that shipped: `undefined === false` is false, so the flip
  // never selected and nothing anywhere reported a problem. Asserting on the
  // undefined case makes the omission loud.
  const a = makeAnimator();
  const proxy = renderProxy();
  delete proxy.canDoubleJump;
  stepAnimator(a, proxy, 1 / 60);
  assert.equal(a.actionId, 'jumpUp',
    'an incomplete proxy degrades to the ordinary jump - documented, not accidental');
});

test('the flip is a one-shot, so it cannot leave the body inverted', () => {
  assert.equal(CLIPS.flip.loop, false);
  const a = makeAnimator();
  const p = renderProxy({ canDoubleJump: false });
  // Run well past the clip's duration on the ground, as a landing would.
  stepAnimator(a, p, 1 / 60);
  const landed = renderProxy({ state: STATE.RUN, grounded: true, canDoubleJump: true });
  for (let i = 0; i < 120; i++) stepAnimator(a, landed, 1 / 60);
  const pitch = a.pose[BONE.ROOT * 3];
  assert.ok(Math.abs(pitch) < 0.05, `body returns upright after landing, pitch ${pitch}`);
});
