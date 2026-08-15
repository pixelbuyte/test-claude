/**
 * Clip sampling and blending.
 *
 * Pure maths over flat Float32Arrays - no three.js, no DOM. That is what lets
 * "do the crossfade weights sum to one" and "does a footstep fire exactly once
 * per cycle" be ordinary assertions rather than something to eyeball.
 *
 * A pose is a flat array of Euler angles, three per bone, in BONE order.
 */
import { POSE_SIZE } from '../../data/anim/rig.js';

/**
 * Samples one track at normalised time `t`.
 *
 * Keys are stored flat as [t0, v0, t1, v1, ...] with t ascending, so this is a
 * short linear scan over a handful of entries - cheaper than binary search at
 * these sizes, and branch-predictable.
 */
export function sampleTrack(keys, t) {
  const n = keys.length;
  if (n === 0) return 0;
  if (n === 2) return keys[1];

  if (t <= keys[0]) return keys[1];
  if (t >= keys[n - 2]) return keys[n - 1];

  for (let i = 0; i + 3 < n; i += 2) {
    const t0 = keys[i];
    const t1 = keys[i + 2];
    if (t >= t0 && t <= t1) {
      const span = t1 - t0;
      const f = span > 0 ? (t - t0) / span : 0;
      const v0 = keys[i + 1];
      return v0 + (keys[i + 3] - v0) * f;
    }
  }
  return keys[n - 1];
}

/**
 * Writes a clip's pose at normalised time `t` into `out`.
 *
 * Zeroes first: a clip only lists the bones it moves, and anything it does not
 * mention must return to rest rather than keep the previous clip's value.
 */
export function samplePose(clip, t, out) {
  out.fill(0);
  const tracks = clip.tracks;
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const index = track.bone * 3 + track.axis;
    // += rather than =: two tracks may legitimately drive the same channel.
    out[index] += sampleTrack(track.keys, t);
  }
  return out;
}

/** `out = out * (1 - w) + src * w`. The one operation the blend tree needs. */
export function blendInto(out, src, w) {
  if (w <= 0) return out;
  if (w >= 1) {
    out.set(src);
    return out;
  }
  const inv = 1 - w;
  for (let i = 0; i < POSE_SIZE; i++) out[i] = out[i] * inv + src[i] * w;
  return out;
}

/** Adds a pose on top at weight `w` - used by the lean/twist layer. */
export function addInto(out, src, w) {
  if (w === 0) return out;
  for (let i = 0; i < POSE_SIZE; i++) out[i] += src[i] * w;
  return out;
}

/**
 * Advances a clip's playhead and reports any events crossed.
 *
 * Events are reported by *crossing*, not by proximity, so a clip played at any
 * rate fires each event exactly once per cycle - which is the whole reason
 * footsteps are embedded in the clip rather than fired on a timer.
 *
 * @param {object} state  { time, clip, rate }
 * @param {number} dt
 * @param {Function} onEvent  called with (name) for each event crossed
 * @returns whether a non-looping clip has finished
 */
export function advanceClip(state, dt, onEvent) {
  const clip = state.clip;
  if (!clip) return true;

  const duration = clip.duration / (state.rate || 1);
  const before = state.time;
  let after = before + dt;

  let finished = false;
  if (after >= duration) {
    if (clip.loop) {
      after %= duration;
    } else {
      after = duration;
      finished = true;
    }
  }

  if (clip.events && onEvent) {
    if (dt >= duration) {
      // A frame at least one whole cycle long steps over every event. Fire each
      // exactly once rather than none (the naive window is empty here) and
      // rather than several times (nobody wants four footsteps from one stall).
      for (let i = 0; i < clip.events.length; i++) onEvent(clip.events[i].name, clip.events[i].t);
    } else {
      const t0 = before / duration;
      const t1 = after / duration;
      for (let i = 0; i < clip.events.length; i++) {
        const e = clip.events[i];
        const crossed = t1 >= t0
          ? (e.t > t0 && e.t <= t1)
          // Wrapped around this frame: the window is (t0, 1] plus [0, t1].
          : (e.t > t0 || e.t <= t1);
        if (crossed) onEvent(e.name, e.t);
      }
    }
  }

  state.time = after;
  return finished;
}

/** Normalised playhead position, 0..1. */
export function clipPhase(state) {
  const clip = state.clip;
  if (!clip) return 0;
  const duration = clip.duration / (state.rate || 1);
  return duration > 0 ? Math.min(1, state.time / duration) : 0;
}
