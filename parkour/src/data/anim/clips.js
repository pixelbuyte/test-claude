/**
 * Animation clips, as pure data.
 *
 * A clip is Euler keyframe tracks plus a blend-in time and, optionally, embedded
 * events. The events are the reason this is data rather than code: a footstep
 * fires at the exact frame the foot plants, so audio stays in sync at any
 * playback rate rather than being triggered on a guessed timer.
 *
 * Angles are radians. `t` is normalised 0..1 across the clip, so retiming a clip
 * is one number rather than a rewrite.
 *
 * Only bones that actually move are listed; anything absent stays at rest.
 */
import { BONE } from './rig.js';

const PI = Math.PI;

/**
 * @typedef {object} Track
 * @property {number} bone   BONE id
 * @property {number} axis   0=x, 1=y, 2=z
 * @property {number[]} keys flat [t0, v0, t1, v1, ...], t ascending
 */

/**
 * @typedef {object} Clip
 * @property {string} id
 * @property {number} duration   seconds at rate 1
 * @property {boolean} loop
 * @property {number} blendIn    seconds to crossfade in
 * @property {Track[]} tracks
 * @property {{t: number, name: string}[]} [events]
 */

/** Arms and legs swinging in opposition - the shape every gait shares. */
function gait(amplitude, lean, armLift) {
  return [
    { bone: BONE.THIGH_L, axis: 0, keys: [0, amplitude, 0.5, -amplitude, 1, amplitude] },
    { bone: BONE.THIGH_R, axis: 0, keys: [0, -amplitude, 0.5, amplitude, 1, -amplitude] },
    { bone: BONE.SHIN_L, axis: 0, keys: [0, 0.1, 0.25, -amplitude * 1.1, 0.5, -0.15, 0.75, -0.1, 1, 0.1] },
    { bone: BONE.SHIN_R, axis: 0, keys: [0, -0.15, 0.25, -0.1, 0.5, 0.1, 0.75, -amplitude * 1.1, 1, -0.15] },
    { bone: BONE.ARM_L, axis: 0, keys: [0, -amplitude * 0.8 - armLift, 0.5, amplitude * 0.8 - armLift, 1, -amplitude * 0.8 - armLift] },
    { bone: BONE.ARM_R, axis: 0, keys: [0, amplitude * 0.8 - armLift, 0.5, -amplitude * 0.8 - armLift, 1, amplitude * 0.8 - armLift] },
    { bone: BONE.FOREARM_L, axis: 0, keys: [0, -0.5, 0.5, -0.9, 1, -0.5] },
    { bone: BONE.FOREARM_R, axis: 0, keys: [0, -0.9, 0.5, -0.5, 1, -0.9] },
    { bone: BONE.SPINE, axis: 0, keys: [0, lean, 1, lean] },
    { bone: BONE.HIPS, axis: 1, keys: [0, 0.08, 0.5, -0.08, 1, 0.08] },
    { bone: BONE.CHEST, axis: 1, keys: [0, -0.1, 0.5, 0.1, 1, -0.1] },
  ];
}

export const CLIPS = {
  idle: {
    id: 'idle', duration: 2.4, loop: true, blendIn: 0.2,
    tracks: [
      { bone: BONE.CHEST, axis: 0, keys: [0, 0.02, 0.5, 0.06, 1, 0.02] },
      { bone: BONE.HEAD, axis: 1, keys: [0, -0.08, 0.5, 0.08, 1, -0.08] },
      { bone: BONE.ARM_L, axis: 2, keys: [0, 0.08, 1, 0.08] },
      { bone: BONE.ARM_R, axis: 2, keys: [0, -0.08, 1, -0.08] },
    ],
  },

  run: {
    id: 'run', duration: 0.62, loop: true, blendIn: 0.12,
    tracks: gait(0.62, 0.12, 0.55),
    // Two footfalls per cycle, at the frames the feet actually plant.
    events: [{ t: 0.24, name: 'footstep' }, { t: 0.74, name: 'footstep' }],
  },

  sprint: {
    id: 'sprint', duration: 0.44, loop: true, blendIn: 0.12,
    tracks: gait(0.85, 0.26, 0.75),
    events: [{ t: 0.22, name: 'footstep' }, { t: 0.72, name: 'footstep' }],
  },

  jumpUp: {
    id: 'jumpUp', duration: 0.45, loop: false, blendIn: 0.08,
    tracks: [
      { bone: BONE.SPINE, axis: 0, keys: [0, -0.15, 1, 0.05] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, -0.9, 1, -0.4] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.35, 1, -0.6] },
      { bone: BONE.SHIN_L, axis: 0, keys: [0, -1.1, 1, -0.5] },
      { bone: BONE.SHIN_R, axis: 0, keys: [0, -0.3, 1, -0.8] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, -2.1, 1, -1.5] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, -1.6, 1, -1.1] },
    ],
  },

  /**
   * A front somersault on the double jump.
   *
   * The rotation lives on BONE.ROOT's X channel, which nothing else writes -
   * and which the view discarded outright until now, so no clip could pitch the
   * body at all. A flip is exactly that pitch, so it was impossible by
   * construction rather than merely unimplemented.
   *
   * Duration is matched to the double jump's hang time. Landing a rotation
   * short looks far worse than not rotating, so the tuck opens out by 0.8 and
   * the last fifth is spent upright and reaching for the ground.
   */
  flip: {
    id: 'flip', duration: 0.66, loop: false, blendIn: 0.05,
    tracks: [
      { bone: BONE.ROOT, axis: 0, keys: [0, 0, 0.12, 0.5, 0.82, PI * 2 - 0.35, 1, PI * 2] },
      // Tuck in hard, then open out to land - the shape that makes a flip read
      // as athletic rather than as a model spinning on a spit.
      { bone: BONE.THIGH_L, axis: 0, keys: [0, -0.7, 0.35, -2.3, 0.72, -1.9, 1, -0.35] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.5, 0.35, -2.1, 0.72, -2.0, 1, -0.5] },
      { bone: BONE.SHIN_L, axis: 0, keys: [0, -0.9, 0.35, -2.4, 0.72, -2.2, 1, -0.3] },
      { bone: BONE.SHIN_R, axis: 0, keys: [0, -0.7, 0.35, -2.3, 0.72, -2.3, 1, -0.45] },
      { bone: BONE.SPINE, axis: 0, keys: [0, -0.1, 0.35, 0.55, 0.75, 0.3, 1, -0.05] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, -2.4, 0.3, -0.9, 0.75, -1.4, 1, -2.2] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, -2.3, 0.3, -0.8, 0.75, -1.3, 1, -2.1] },
      { bone: BONE.FOREARM_L, axis: 0, keys: [0, -0.6, 0.35, -1.9, 1, -0.5] },
      { bone: BONE.FOREARM_R, axis: 0, keys: [0, -0.6, 0.35, -1.9, 1, -0.5] },
    ],
  },

  fall: {
    id: 'fall', duration: 0.6, loop: true, blendIn: 0.14,
    tracks: [
      { bone: BONE.SPINE, axis: 0, keys: [0, 0.16, 0.5, 0.22, 1, 0.16] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, -0.5, 0.5, -0.35, 1, -0.5] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.3, 0.5, -0.5, 1, -0.3] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, -2.3, 0.5, -2.5, 1, -2.3] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, -2.2, 0.5, -2.0, 1, -2.2] },
      { bone: BONE.ARM_L, axis: 2, keys: [0, 0.5, 1, 0.5] },
      { bone: BONE.ARM_R, axis: 2, keys: [0, -0.5, 1, -0.5] },
    ],
  },

  land: {
    id: 'land', duration: 0.24, loop: false, blendIn: 0.05,
    tracks: [
      { bone: BONE.HIPS, axis: 0, keys: [0, 0.3, 0.4, 0.5, 1, 0.05] },
      { bone: BONE.SPINE, axis: 0, keys: [0, 0.35, 0.4, 0.5, 1, 0.1] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, 0.7, 0.4, 0.9, 1, 0.1] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, 0.6, 0.4, 0.8, 1, 0.05] },
      { bone: BONE.SHIN_L, axis: 0, keys: [0, -1.1, 0.4, -1.4, 1, -0.2] },
      { bone: BONE.SHIN_R, axis: 0, keys: [0, -1.0, 0.4, -1.3, 1, -0.15] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, -1.2, 1, -0.4] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, -1.1, 1, -0.35] },
    ],
    events: [{ t: 0.05, name: 'land' }],
  },

  slide: {
    // A held pose with a small cycle in it. Every track returns to its own
    // first value at t=1, because a looping clip that drifts pops once a cycle.
    id: 'slide', duration: 0.5, loop: true, blendIn: 0.08,
    tracks: [
      { bone: BONE.HIPS, axis: 0, keys: [0, 1.0, 0.5, 1.05, 1, 1.0] },
      { bone: BONE.SPINE, axis: 0, keys: [0, -0.35, 0.5, -0.3, 1, -0.35] },
      { bone: BONE.HEAD, axis: 0, keys: [0, -0.4, 0.5, -0.45, 1, -0.4] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, -1.0, 0.5, -0.9, 1, -1.0] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.4, 0.5, -0.5, 1, -0.4] },
      { bone: BONE.SHIN_L, axis: 0, keys: [0, -0.6, 0.5, -0.7, 1, -0.6] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, -1.4, 0.5, -1.3, 1, -1.4] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, 0.5, 0.5, 0.6, 1, 0.5] },
    ],
    events: [{ t: 0.02, name: 'scrape' }],
  },

  vault: {
    id: 'vault', duration: 0.35, loop: false, blendIn: 0.06,
    tracks: [
      // The planted hand: forward and down over the obstacle, then released.
      { bone: BONE.ARM_R, axis: 0, keys: [0, -0.4, 0.35, 1.5, 0.7, 1.2, 1, -0.6] },
      { bone: BONE.FOREARM_R, axis: 0, keys: [0, -0.6, 0.35, -0.1, 1, -0.7] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, -1.8, 0.5, -2.4, 1, -1.4] },
      { bone: BONE.SPINE, axis: 0, keys: [0, 0.3, 0.5, 0.7, 1, 0.15] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, -0.6, 0.5, -1.5, 1, -0.4] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.5, 0.5, -1.3, 1, -0.3] },
      { bone: BONE.SHIN_L, axis: 0, keys: [0, -0.8, 0.5, -1.6, 1, -0.5] },
      { bone: BONE.SHIN_R, axis: 0, keys: [0, -0.7, 0.5, -1.5, 1, -0.4] },
    ],
    events: [{ t: 0.3, name: 'plant' }],
  },

  wallrun: {
    id: 'wallrun', duration: 0.5, loop: true, blendIn: 0.1,
    tracks: [
      { bone: BONE.SPINE, axis: 2, keys: [0, 0.35, 1, 0.35] },
      { bone: BONE.HIPS, axis: 1, keys: [0, 0.25, 1, 0.25] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, 0.7, 0.5, -0.7, 1, 0.7] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.7, 0.5, 0.7, 1, -0.7] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, -1.7, 0.5, -1.5, 1, -1.7] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, 0.4, 0.5, -0.4, 1, 0.4] },
    ],
    events: [{ t: 0.2, name: 'footstep' }, { t: 0.7, name: 'footstep' }],
  },

  wallJump: {
    id: 'wallJump', duration: 0.3, loop: false, blendIn: 0.05,
    tracks: [
      { bone: BONE.SPINE, axis: 2, keys: [0, 0.4, 1, -0.15] },
      { bone: BONE.HIPS, axis: 1, keys: [0, 0.3, 1, -0.1] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, -0.8, 0.4, -2.4, 1, -1.6] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, -1.2, 0.4, -2.0, 1, -1.2] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, 0.6, 0.5, -1.0, 1, -0.5] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.4, 0.5, -0.8, 1, -0.4] },
    ],
    events: [{ t: 0.02, name: 'push' }],
  },

  ledgeGrab: {
    id: 'ledgeGrab', duration: 0.25, loop: false, blendIn: 0.05,
    tracks: [
      { bone: BONE.ARM_L, axis: 0, keys: [0, -2.6, 1, -2.8] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, -2.6, 1, -2.8] },
      { bone: BONE.SPINE, axis: 0, keys: [0, 0.1, 1, 0.2] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, -0.4, 1, -0.7] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.3, 1, -0.6] },
    ],
  },

  mantle: {
    id: 'mantle', duration: 0.4, loop: false, blendIn: 0.06,
    tracks: [
      { bone: BONE.ARM_L, axis: 0, keys: [0, -2.8, 0.5, -1.4, 1, -0.4] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, -2.8, 0.5, -1.2, 1, -0.3] },
      { bone: BONE.SPINE, axis: 0, keys: [0, 0.4, 0.5, 0.55, 1, 0.1] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, -1.4, 0.5, -1.6, 1, -0.3] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.8, 0.5, -1.2, 1, -0.2] },
      { bone: BONE.SHIN_L, axis: 0, keys: [0, -1.5, 0.5, -1.7, 1, -0.3] },
    ],
    events: [{ t: 0.55, name: 'plant' }],
  },

  stumble: {
    id: 'stumble', duration: 0.5, loop: false, blendIn: 0.06,
    tracks: [
      { bone: BONE.SPINE, axis: 0, keys: [0, 0.6, 0.3, 0.45, 0.7, 0.5, 1, 0.2] },
      { bone: BONE.CHEST, axis: 2, keys: [0, 0.3, 0.4, -0.25, 1, 0.05] },
      { bone: BONE.HEAD, axis: 0, keys: [0, 0.35, 1, 0.1] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, -2.4, 0.5, -1.2, 1, -0.8] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, -1.0, 0.5, -2.2, 1, -0.7] },
      { bone: BONE.THIGH_L, axis: 0, keys: [0, 0.5, 0.4, -0.5, 1, 0.2] },
      { bone: BONE.THIGH_R, axis: 0, keys: [0, -0.5, 0.4, 0.6, 1, -0.2] },
    ],
  },

  victory: {
    id: 'victory', duration: 1.6, loop: true, blendIn: 0.2,
    tracks: [
      { bone: BONE.ARM_L, axis: 0, keys: [0, -2.8, 0.5, -3.0, 1, -2.8] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, -3.0, 0.5, -2.8, 1, -3.0] },
      { bone: BONE.SPINE, axis: 0, keys: [0, -0.12, 0.5, -0.2, 1, -0.12] },
      { bone: BONE.HIPS, axis: 1, keys: [0, -0.2, 0.5, 0.2, 1, -0.2] },
    ],
  },

  defeat: {
    id: 'defeat', duration: 2.0, loop: true, blendIn: 0.25,
    tracks: [
      { bone: BONE.SPINE, axis: 0, keys: [0, 0.42, 0.5, 0.48, 1, 0.42] },
      { bone: BONE.HEAD, axis: 0, keys: [0, 0.5, 0.5, 0.55, 1, 0.5] },
      { bone: BONE.ARM_L, axis: 0, keys: [0, 0.15, 0.5, 0.1, 1, 0.15] },
      { bone: BONE.ARM_R, axis: 0, keys: [0, 0.1, 0.5, 0.15, 1, 0.1] },
    ],
  },
};

/** Clip ids, for tests and tooling. */
export const CLIP_IDS = Object.keys(CLIPS);

export { PI };
