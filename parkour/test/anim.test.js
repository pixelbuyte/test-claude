/**
 * The animation system.
 *
 * Clips are pure data and the blend tree is pure maths, which is the point: the
 * questions that actually matter about an animation system - do crossfade
 * weights stay sane, does a footstep fire exactly once per cycle at any playback
 * rate - are ordinary assertions here rather than something to eyeball at 60fps.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CLIPS, CLIP_IDS } from '../src/data/anim/clips.js';
import { BONES, BONE, BONE_COUNT, POSE_SIZE, makePose } from '../src/data/anim/rig.js';
import { sampleTrack, samplePose, blendInto, addInto, advanceClip, clipPhase } from '../src/sim/anim/blend.js';
import { makeAnimator, stepAnimator, STATE_CLIP } from '../src/sim/anim/AnimationController.js';
import { STATE, STATE_INFO } from '../src/sim/player/states.js';
import { MOVEMENT } from '../src/config.js';

/** A racer-shaped object good enough for the animator. */
function racer(over = {}) {
  return {
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 12 },
    speed: 12,
    grounded: true,
    state: STATE.RUN,
    ...over,
  };
}

// --- The rig ----------------------------------------------------------------

test('the rig is a well-formed hierarchy', () => {
  assert.equal(BONES.length, BONE_COUNT);

  for (let i = 0; i < BONES.length; i++) {
    const b = BONES[i];
    assert.equal(typeof b.name, 'string');
    // A parent must already exist, or the build loop would attach to undefined.
    assert.ok(b.parent < i, `${b.name} refers to a parent that comes after it`);
    assert.equal(b.offset.length, 3);
    assert.equal(b.size.length, 3);
  }

  assert.equal(BONES[BONE.ROOT].parent, -1, 'exactly one root');
  assert.equal(BONES.filter((b) => b.parent === -1).length, 1);
});

// --- Sampling ---------------------------------------------------------------

test('a track samples, interpolates, and clamps at both ends', () => {
  const keys = [0, 0, 0.5, 10, 1, 0];

  assert.equal(sampleTrack(keys, 0), 0);
  assert.equal(sampleTrack(keys, 0.5), 10);
  assert.equal(sampleTrack(keys, 1), 0);
  assert.equal(sampleTrack(keys, 0.25), 5, 'should interpolate linearly');

  // Outside the range clamps rather than extrapolating.
  assert.equal(sampleTrack(keys, -1), 0);
  assert.equal(sampleTrack(keys, 5), 0);
  assert.equal(sampleTrack([], 0.5), 0, 'an empty track is silent, not a crash');
  assert.equal(sampleTrack([0, 7], 0.9), 7, 'a single key holds its value');
});

test('sampling a pose zeroes bones the clip does not mention', () => {
  const pose = makePose();
  pose.fill(99);

  samplePose(CLIPS.idle, 0.5, pose);

  // idle drives chest, head and both upper arms; a thigh must have returned to
  // rest rather than keeping the previous clip's value.
  assert.equal(pose[BONE.THIGH_L * 3], 0,
    'a bone the clip does not animate must return to rest');
  assert.equal(pose.length, POSE_SIZE);
});

test('every clip is structurally sound', () => {
  for (const id of CLIP_IDS) {
    const clip = CLIPS[id];
    assert.equal(clip.id, id, `${id} disagrees with its own key`);
    assert.ok(clip.duration > 0, `${id} has no duration`);
    assert.ok(clip.blendIn >= 0, `${id} has a negative blend`);
    assert.ok(clip.tracks.length > 0, `${id} animates nothing`);

    for (const track of clip.tracks) {
      assert.ok(track.bone >= 0 && track.bone < BONE_COUNT, `${id} targets bone ${track.bone}`);
      assert.ok(track.axis >= 0 && track.axis <= 2, `${id} targets axis ${track.axis}`);
      assert.equal(track.keys.length % 2, 0, `${id} has a dangling key`);
      assert.ok(track.keys.length >= 2, `${id} has an empty track`);

      // Times must ascend, or the linear scan will pick the wrong segment.
      for (let i = 2; i < track.keys.length; i += 2) {
        assert.ok(track.keys[i] >= track.keys[i - 2],
          `${id} has out-of-order keyframes on bone ${track.bone}`);
      }
      assert.ok(track.keys[0] >= 0 && track.keys[track.keys.length - 2] <= 1,
        `${id} has keys outside 0..1`);

      for (const v of track.keys) {
        assert.ok(Number.isFinite(v), `${id} has a non-finite key`);
      }
    }

    for (const e of clip.events || []) {
      assert.ok(e.t >= 0 && e.t <= 1, `${id} event ${e.name} is outside the clip`);
      assert.ok(typeof e.name === 'string' && e.name.length > 0);
    }
  }
});

test('looping clips start and end on the same pose', () => {
  // Otherwise the loop visibly pops every cycle.
  const start = makePose();
  const end = makePose();

  for (const id of CLIP_IDS) {
    const clip = CLIPS[id];
    if (!clip.loop) continue;
    samplePose(clip, 0, start);
    samplePose(clip, 1, end);
    for (let i = 0; i < POSE_SIZE; i++) {
      assert.ok(Math.abs(start[i] - end[i]) < 1e-6,
        `${id} does not loop cleanly: channel ${i} is ${start[i]} at t=0 and ${end[i]} at t=1`);
    }
  }
});

// --- Blending ---------------------------------------------------------------

test('blending is a proper weighted average', () => {
  const a = makePose();
  const b = makePose();
  a.fill(0);
  b.fill(10);

  blendInto(a, b, 0.5);
  assert.equal(a[0], 5, 'half weight should land halfway');

  const c = makePose();
  c.fill(0);
  blendInto(c, b, 0);
  assert.equal(c[0], 0, 'zero weight must change nothing');

  const d = makePose();
  d.fill(0);
  blendInto(d, b, 1);
  assert.equal(d[0], 10, 'full weight must replace');
});

test('blend weights always sum to one', () => {
  // The property that matters: a blend never inflates or deflates the pose.
  const a = makePose();
  const b = makePose();
  a.fill(4);
  b.fill(4);

  for (const w of [0, 0.1, 0.5, 0.9, 1]) {
    const out = makePose();
    out.set(a);
    blendInto(out, b, w);
    assert.ok(Math.abs(out[0] - 4) < 1e-6,
      `blending two identical poses at w=${w} changed the value to ${out[0]}`);
  }
});

test('additive layering adds rather than replaces', () => {
  const base = makePose();
  const add = makePose();
  base.fill(1);
  add.fill(2);

  addInto(base, add, 0.5);
  assert.equal(base[0], 2, '1 + 2*0.5 should be 2');
});

// --- Playback and events ----------------------------------------------------

test('a footstep fires exactly once per cycle, at any rate', () => {
  for (const rate of [0.5, 1, 2, 3.7]) {
    const state = { clip: CLIPS.run, time: 0, rate };
    const duration = CLIPS.run.duration / rate;
    let steps = 0;

    // Three whole cycles, in small slices.
    const dt = duration / 37;
    for (let i = 0; i < 37 * 3; i++) {
      advanceClip(state, dt, (name) => { if (name === 'footstep') steps++; });
    }

    assert.equal(steps, 6,
      `at rate ${rate} the run clip fired ${steps} footsteps over 3 cycles, expected 6`);
  }
});

test('events fire once even when a frame skips past several', () => {
  const state = { clip: CLIPS.run, time: 0, rate: 1 };
  let steps = 0;

  // One enormous frame covering a whole cycle: both footsteps, no duplicates.
  advanceClip(state, CLIPS.run.duration, (name) => { if (name === 'footstep') steps++; });
  assert.equal(steps, 2);
});

test('a non-looping clip finishes and stops', () => {
  const state = { clip: CLIPS.land, time: 0, rate: 1 };

  assert.equal(advanceClip(state, CLIPS.land.duration * 0.5, null), false);
  assert.equal(advanceClip(state, CLIPS.land.duration, null), true, 'should report finished');
  assert.equal(clipPhase(state), 1, 'and hold its final frame');
});

test('a looping clip never reports finished', () => {
  const state = { clip: CLIPS.run, time: 0, rate: 1 };
  for (let i = 0; i < 20; i++) {
    assert.equal(advanceClip(state, CLIPS.run.duration * 0.6, null), false);
  }
});

// --- The blend tree ---------------------------------------------------------

test('every parkour state maps to a clip that exists', () => {
  for (const [state, clipId] of Object.entries(STATE_CLIP)) {
    assert.ok(CLIPS[clipId], `state ${state} maps to missing clip ${clipId}`);
    assert.ok(STATE_INFO[state], `state ${state} is not in the state table`);
  }
});

test('the animator produces a finite pose in every state', () => {
  const a = makeAnimator();

  for (let state = 0; state < STATE_INFO.length; state++) {
    const p = racer({ state, grounded: !STATE_INFO[state].airborne });
    for (let i = 0; i < 40; i++) stepAnimator(a, p, 1 / 60);

    for (let i = 0; i < POSE_SIZE; i++) {
      assert.ok(Number.isFinite(a.pose[i]),
        `pose channel ${i} went non-finite in state ${STATE_INFO[state].name}`);
      // Nothing should ever be spun more than a full turn by the blend tree.
      assert.ok(Math.abs(a.pose[i]) < Math.PI * 2,
        `pose channel ${i} reached ${a.pose[i]} in ${STATE_INFO[state].name}`);
    }
  }
});

test('locomotion follows speed rather than being pinned', () => {
  const slow = makeAnimator();
  const fast = makeAnimator();

  const slowRacer = racer({ speed: 1 });
  const fastRacer = racer({ speed: MOVEMENT.speedMax });

  for (let i = 0; i < 30; i++) {
    stepAnimator(slow, slowRacer, 1 / 60);
    stepAnimator(fast, fastRacer, 1 / 60);
  }

  assert.ok(fast.sprint.rate > slow.sprint.rate,
    'stride rate should rise with speed, or the feet will slide');

  let differs = false;
  for (let i = 0; i < POSE_SIZE; i++) {
    if (Math.abs(slow.pose[i] - fast.pose[i]) > 1e-3) { differs = true; break; }
  }
  assert.ok(differs, 'walking and sprinting produced an identical pose');
});

test('a one-shot action releases back to locomotion', () => {
  const a = makeAnimator();
  const p = racer({ state: STATE.LAND, grounded: true });

  for (let i = 0; i < 10; i++) stepAnimator(a, p, 1 / 60);
  assert.ok(a.actionWeight > 0, 'the land clip never took hold');

  // Back to running: the action layer must let go rather than holding its pose.
  p.state = STATE.RUN;
  for (let i = 0; i < 60; i++) stepAnimator(a, p, 1 / 60);
  assert.equal(a.actionWeight, 0, 'the action layer never released');
  assert.equal(a.actionId, null);
});

test('footsteps only fire while actually on the ground', () => {
  const a = makeAnimator();
  const airborne = racer({ state: STATE.FALL, grounded: false });

  let steps = 0;
  for (let i = 0; i < 120; i++) {
    stepAnimator(a, airborne, 1 / 60);
    steps += a.events.filter((e) => e === 'footstep').length;
  }
  assert.equal(steps, 0, 'a falling runner should not be taking footsteps');
});

test('lean responds to lateral velocity and stays bounded', () => {
  const a = makeAnimator();
  const left = racer({ vel: { x: -MOVEMENT.lateralMax, y: 0, z: 12 } });
  const right = racer({ vel: { x: MOVEMENT.lateralMax, y: 0, z: 12 } });

  stepAnimator(a, left, 1 / 60);
  const leanLeft = a.pose[BONE.ROOT * 3 + 2];

  stepAnimator(a, right, 1 / 60);
  const leanRight = a.pose[BONE.ROOT * 3 + 2];

  assert.ok(leanLeft * leanRight < 0, 'leaning should reverse with direction');
  assert.ok(Math.abs(leanLeft) <= 0.35 && Math.abs(leanRight) <= 0.35,
    'lean must stay bounded however hard the runner steers');
});
