/**
 * The blend tree.
 *
 * Three layers, applied in order:
 *   0  locomotion - a 1-D blend across idle / run / sprint by normalised speed
 *   1  action     - the parkour state's clip, crossfaded over its own blendIn
 *   2  additive   - lean and twist from lateral velocity
 *
 * Pure: it reads a racer's state and writes Euler angles into a flat buffer.
 * Something in render/ applies that buffer to actual objects; nothing here knows
 * those objects exist, which is why the whole thing is testable in Node.
 */
import { MOVEMENT } from '../../config.js';
import { STATE, STATE_INFO } from '../player/states.js';
import { CLIPS } from '../../data/anim/clips.js';
import { BONE, makePose } from '../../data/anim/rig.js';
import { samplePose, blendInto, addInto, advanceClip, clipPhase } from './blend.js';

/** Which clip a state wants. Absent means "leave it to the locomotion layer". */
const STATE_CLIP = {
  [STATE.JUMP]: 'jumpUp',
  [STATE.FALL]: 'fall',
  [STATE.LAND]: 'land',
  [STATE.SLIDE]: 'slide',
  [STATE.VAULT]: 'vault',
  [STATE.WALLRUN]: 'wallrun',
  [STATE.WALLJUMP]: 'wallJump',
  [STATE.LEDGE]: 'ledgeGrab',
  [STATE.MANTLE]: 'mantle',
  [STATE.STUMBLE]: 'stumble',
  [STATE.DEAD]: 'stumble',
  [STATE.VICTORY]: 'victory',
  [STATE.DEFEAT]: 'defeat',
};

export function makeAnimator() {
  return {
    /** The pose the view should apply. */
    pose: makePose(),

    // Layer 0: locomotion, always running so there is something to fall back to.
    idle: { clip: CLIPS.idle, time: 0, rate: 1 },
    run: { clip: CLIPS.run, time: 0, rate: 1 },
    sprint: { clip: CLIPS.sprint, time: 0, rate: 1 },

    // Layer 1: the current action, and the one it is fading out of.
    action: { clip: null, time: 0, rate: 1 },
    actionWeight: 0,
    actionId: null,

    _locoPose: makePose(),
    _tmp: makePose(),
    _actionPose: makePose(),
    _leanPose: makePose(),

    /** Drained by the view/audio layer once per frame. */
    events: [],
  };
}

/**
 * Advances the animator and rebuilds `pose`.
 *
 * @param {object} a   animator
 * @param {object} p   racer (or the interpolated render proxy)
 * @param {number} dt  seconds since the last rendered frame
 */
export function stepAnimator(a, p, dt) {
  a.events.length = 0;
  const emit = (name) => a.events.push(name);

  // --- Layer 0: locomotion -------------------------------------------------
  // Stride rate follows actual speed, so feet plant at the right cadence at any
  // pace instead of sliding.
  const speedT = Math.min(1, Math.max(0, p.speed / MOVEMENT.speedMax));
  const grounded = p.grounded && !STATE_INFO[p.state].airborne;

  a.run.rate = 0.7 + speedT * 1.1;
  a.sprint.rate = 0.85 + speedT * 0.8;

  // Footstep events only count while the runner is actually on the ground.
  advanceClip(a.idle, dt, null);
  advanceClip(a.run, dt, grounded ? emit : null);
  advanceClip(a.sprint, dt, grounded ? emit : null);

  // idle -> run over the first third of the speed range, run -> sprint above it.
  const loco = a._locoPose;
  const tmp = a._tmp;
  if (speedT < 0.33) {
    const w = speedT / 0.33;
    samplePose(CLIPS.idle, clipPhase(a.idle), loco);
    samplePose(CLIPS.run, clipPhase(a.run), tmp);
    blendInto(loco, tmp, w);
  } else {
    const w = (speedT - 0.33) / 0.67;
    samplePose(CLIPS.run, clipPhase(a.run), loco);
    samplePose(CLIPS.sprint, clipPhase(a.sprint), tmp);
    blendInto(loco, tmp, w);
  }

  a.pose.set(loco);

  // --- Layer 1: the action -------------------------------------------------
  const wanted = STATE_CLIP[p.state] || null;

  if (wanted !== a.actionId) {
    a.actionId = wanted;
    a.action.clip = wanted ? CLIPS[wanted] : null;
    a.action.time = 0;
    // Crossfade from wherever the previous action left off rather than snapping.
    if (!wanted) a.actionWeight = Math.min(a.actionWeight, 1);
  }

  if (a.action.clip) {
    const finished = advanceClip(a.action, dt, emit);
    const blendIn = Math.max(0.01, a.action.clip.blendIn);
    a.actionWeight = Math.min(1, a.actionWeight + dt / blendIn);

    // A finished one-shot releases back to locomotion instead of holding its
    // last frame, which is what makes a land or a vault feel like it ends.
    if (finished && !a.action.clip.loop) {
      a.actionWeight = Math.max(0, a.actionWeight - dt / blendIn);
      if (a.actionWeight <= 0) {
        a.action.clip = null;
        a.actionId = null;
      }
    }

    if (a.action.clip) {
      samplePose(a.action.clip, clipPhase(a.action), a._actionPose);
      blendInto(a.pose, a._actionPose, a.actionWeight);
    }
  } else if (a.actionWeight > 0) {
    a.actionWeight = Math.max(0, a.actionWeight - dt / 0.12);
  }

  // --- Layer 2: lean and twist, additive -----------------------------------
  const lean = clampAbs(-p.vel.x * 0.028, 0.34);
  const twist = clampAbs(-p.vel.x * 0.02, 0.26);
  const pitch = clampAbs(p.speed * 0.006, 0.14);

  const leanPose = a._leanPose;
  leanPose.fill(0);
  leanPose[BONE.ROOT * 3 + 2] = lean;
  leanPose[BONE.ROOT * 3 + 1] = twist;
  leanPose[BONE.CHEST * 3 + 2] = lean * 0.5;
  leanPose[BONE.HEAD * 3 + 1] = -twist * 0.6;
  leanPose[BONE.SPINE * 3] = pitch;
  addInto(a.pose, leanPose, 1);

  return a.pose;
}

function clampAbs(v, limit) {
  return v > limit ? limit : v < -limit ? -limit : v;
}

export { STATE_CLIP };
