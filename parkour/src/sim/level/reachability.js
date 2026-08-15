/**
 * What the runner can physically do.
 *
 * Every number here is derived from `config.js` rather than written down
 * separately. That is the point: retuning the jump changes what these functions
 * return, the validator re-runs against the new values, and a level that is no
 * longer completable fails a test instead of silently shipping.
 */
import {
  MOVEMENT, PARKOUR,
  apexHeight, airTime, maxGapAtSpeed, maxGapWithDoubleJump, maxWallRunLength,
} from '../../config.js';

/**
 * Safety margin applied to every derived limit.
 *
 * A gap that is exactly at the analytic maximum requires a frame-perfect
 * takeoff, which the whole design says the player should never need. Levels are
 * held to 80% of what is theoretically possible.
 */
export const MARGIN = 0.8;

/** Widest gap clearable from a running jump at `speed`, with margin. */
export function safeGap(speed) {
  return maxGapAtSpeed(speed) * MARGIN;
}

/** Widest gap clearable if the player also spends the double jump. */
export function riskyGap(speed) {
  return maxGapWithDoubleJump(speed) * MARGIN;
}

/** Highest step up onto a ledge from flat ground. */
export function safeStepUp() {
  return (apexHeight() - 0.25) * MARGIN + 0.25;
}

/** Longest stretch of wall a wall-run can carry the runner across. */
export function safeWallRun(speed) {
  return maxWallRunLength(speed) * MARGIN;
}

/** Time in the air from a standing jump - used to space obstacles in time. */
export function jumpAirTime() {
  return airTime();
}

/**
 * Can a gap of `width` be crossed at `speed` by the declared route?
 *
 * `declared` is the chunk's own claim about how the gap is meant to be crossed.
 * A wall-run gap is checked against wall-run reach, because it is not supposed
 * to be jumpable - that is what makes it a wall-run.
 *
 * @returns {{ok: boolean, need: number, have: number, mode: string}}
 */
export function checkGap(width, speed, declared = 'jump') {
  if (declared === 'launch') {
    const reach = speed * airTime(PARKOUR.launchDefaultImpulse) * MARGIN;
    return {
      ok: width <= reach, need: width, have: reach,
      mode: width <= reach ? 'launch' : 'unreachable',
    };
  }

  if (declared === 'wallrun') {
    const reach = safeWallRun(speed);
    return {
      ok: width <= reach, need: width, have: reach,
      mode: width <= reach ? 'wallrun' : 'unreachable',
    };
  }

  const safe = safeGap(speed);
  if (width <= safe) return { ok: true, need: width, have: safe, mode: 'jump' };
  const risky = riskyGap(speed);
  if (width <= risky) return { ok: true, need: width, have: risky, mode: 'double-jump' };
  return { ok: false, need: width, have: risky, mode: 'unreachable' };
}

/** Can a step of `rise` be surmounted at `speed`? */
export function checkStepUp(rise, speed) {
  if (rise <= MOVEMENT.maxStepUp) return { ok: true, mode: 'step' };
  const limit = safeStepUp();
  if (rise <= limit) return { ok: true, mode: 'jump' };
  // A mantle reaches a little higher than a plain jump, because the grab
  // happens on the way past rather than at the apex.
  if (rise <= limit + PARKOUR.ledgeMaxReach) return { ok: true, mode: 'mantle' };
  return { ok: false, mode: 'unreachable', have: limit };
}
