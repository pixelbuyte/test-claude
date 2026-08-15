/**
 * Integration and collision resolution for one racer.
 *
 * Resolution is axis-separated in a fixed Y -> Z -> X order, and that order is
 * load-bearing:
 *   Y first, so ground contact is known before anything moves horizontally -
 *     otherwise the runner "steps into" a wall it should have landed on top of.
 *   Z second, because forward is the dominant axis and a forward hit means
 *     something specific: either the parkour layer already turned it into a
 *     vault, or it is a crash.
 *   X last, because a lateral hit is never fatal - it clamps, and flags a
 *     wall-run candidate for the next substep.
 */
import { STEP, BODY, MOVEMENT, PARKOUR, BOOST, LEVEL } from '../../config.js';
import { clamp, springStep, moveToward } from '../math/scalar.js';
import { setBodyAABB } from '../world/colliderSet.js';
import { sweepAxis, safeDelta, groundProbe } from '../world/sweep.js';
import { STATE, STATE_INFO } from './states.js';
import { EV } from '../core/events.js';

/** Half the lateral span the track allows, in metres. */
export const HALF_TRACK = MOVEMENT.laneWidth * (LEVEL.laneCount - 1) / 2;

export function currentHeight(p) {
  return STATE_INFO[p.state].crouched ? BODY.slideHeight : BODY.height;
}

/**
 * Advances velocity for one substep. Does not move the body - `resolve` does
 * that, so collision always sees the velocity that produced it.
 */
export function integrate(p, intent, world) {
  const info = STATE_INFO[p.state];

  // --- Forward speed -------------------------------------------------------
  let target = p.baseSpeed;
  if (p.state === STATE.STUMBLE) target *= 0.45;
  if (p.slowFactor !== 1) target *= p.slowFactor;

  // Slope: running downhill is free speed, uphill costs.
  if (p.grounded && p.groundSlope !== 0) {
    target -= p.groundSlope * MOVEMENT.slopeSpeedFactor;
  }
  if (p.state === STATE.WALLRUN) target *= 1 + PARKOUR.wallRunSpeedBonus;
  if (p.state === STATE.RAIL) target *= 1 + PARKOUR.railSpeedBonus;

  target = clamp(target, MOVEMENT.speedMin, MOVEMENT.speedMax);
  p.speed = moveToward(p.speed, target, MOVEMENT.speedApproach * STEP * 4);

  // Additive boost from pads and power-ups decays once its timer runs out.
  if (p.boostTimer > 0) {
    p.boostTimer -= STEP;
  } else if (p.boostSpeed > 0) {
    p.boostSpeed = Math.max(0, p.boostSpeed - BOOST.decayRate * STEP);
  }

  p.vel.z = clamp(p.speed + p.boostSpeed, 0, MOVEMENT.speedMax + 12);

  // --- Lateral -------------------------------------------------------------
  // The input layer normalises both control schemes to a track position in
  // [-1, 1], so the simulation only ever sees one kind of lateral intent.
  let lateral = clamp(intent.lateralTarget, -1, 1);
  if (p.wallPushTimer > 0) {
    // Just wall-jumped: bias away from the wall for a moment, or the lane
    // spring drags the runner straight back into it.
    lateral = clamp(lateral + p.wallPushDir * 0.85, -1, 1);
  }
  p.targetX = clamp(lateral * HALF_TRACK, p.laneMinX, p.laneMaxX);

  let omega = MOVEMENT.laneSpringOmega;
  if (info.airborne) omega *= MOVEMENT.airControl;
  if (p.state === STATE.WALLRUN) omega *= 0.35;

  // Propose where the spring wants the body; `resolve` decides whether it may
  // actually go there. Integration never moves the body past a wall.
  p.pendingX = springStep(p.pos.x, p.vel.x, p.targetX, omega, STEP, p._springOut);
  p.vel.x = clamp(p._springOut[0], -MOVEMENT.lateralMax, MOVEMENT.lateralMax);

  // --- Gravity -------------------------------------------------------------
  if (!info.scripted) {
    let g = p.vel.y > 0 ? MOVEMENT.gravityUp : MOVEMENT.gravityDown;
    if (p.state === STATE.WALLRUN) {
      // Gravity ramps back in over the second half of the wall-run so the exit
      // feels like losing grip rather than hitting a switch.
      const t = p.stateTime / PARKOUR.wallRunMaxTime;
      const ramp = t < PARKOUR.wallRunGravityRampStart ? 0
        : (t - PARKOUR.wallRunGravityRampStart) / (1 - PARKOUR.wallRunGravityRampStart);
      g *= PARKOUR.wallRunGravityScale + (1 - PARKOUR.wallRunGravityScale) * ramp;
    }
    if (!p.grounded || p.vel.y > 0) {
      p.vel.y += g * STEP;
      if (p.vel.y < MOVEMENT.terminalVelocity) p.vel.y = MOVEMENT.terminalVelocity;
    }
  }
}

/**
 * Moves the body and resolves collisions. Returns nothing; all consequences are
 * written to `p` and pushed as events.
 */
export function resolve(p, world, ev) {
  const { cs, candidates, candidateCount: n } = world;
  // Scripted states drive position from a curve and own it completely - a vault
  // arc deliberately passes through the space the crate occupies. Sweeping here
  // as well would both double the forward motion and report the crate the runner
  // is mid-vault over as a head-on crash.
  if (STATE_INFO[p.state].scripted) return;

  const height = currentHeight(p);
  const body = p._aabb;
  const res = p._sweep;
  const wasGrounded = p.grounded;

  // --- Y -------------------------------------------------------------------
  const dy = p.vel.y * STEP;
  if (dy !== 0) {
    setBodyAABB(body, p.pos.x, p.pos.y, p.pos.z, BODY.halfX, height, BODY.halfZ);
    sweepAxis(body, 1, dy, cs, candidates, n, 0, res);
    p.pos.y += safeDelta(dy, res);
    if (res.index >= 0) {
      if (dy < 0) {
        p.landingImpact = -p.vel.y;
        p.grounded = true;
      }
      p.vel.y = 0;
    }
  }

  // --- Z -------------------------------------------------------------------
  const dz = p.vel.z * STEP;
  if (dz !== 0) {
    setBodyAABB(body, p.pos.x, p.pos.y, p.pos.z, BODY.halfX, height, BODY.halfZ);
    sweepAxis(body, 2, dz, cs, candidates, n, 0, res);
    p.pos.z += safeDelta(dz, res);
    if (res.index >= 0) {
      // A kerb-height lip is not an obstacle, it is a step. Without this every
      // boost pad and every 5 cm seam between two platforms reads as a wall.
      const rise = cs.maxY[res.index] - p.pos.y;
      if (p.grounded && rise > 0 && rise <= MOVEMENT.maxStepUp && dz > 0) {
        p.pos.y = cs.maxY[res.index];
        p.groundY = p.pos.y;
        // Complete the move the sweep cut short; the body is now above the step.
        p.pos.z += dz - safeDelta(dz, res);
        p.blockedTimer = 0;
      } else {
        // Running into something head-on. The parkour layer already had its
        // chance to turn this into a vault, so this is a genuine mistake.
        crash(p, ev);
        // How long the runner has been unable to make forward progress. A
        // stumble costs speed, and a slower runner hits the same obstacle again
        // next substep - without this the runner grinds against a wall forever.
        p.blockedTimer += STEP;
      }
    } else {
      p.blockedTimer = 0;
    }
  }
  // Note: dz === 0 deliberately does not count as blocked. A stationary runner
  // is not wedged - it is waiting for a countdown, and must not die doing so.

  // --- X -------------------------------------------------------------------
  const dx = p.pendingX - p.pos.x;
  if (dx !== 0) {
    setBodyAABB(body, p.pos.x, p.pos.y, p.pos.z, BODY.halfX, height, BODY.halfZ);
    sweepAxis(body, 0, dx, cs, candidates, n, 0, res);
    p.pos.x += safeDelta(dx, res);
    if (res.index >= 0) {
      // A lateral hit never kills - it clamps and leaves a wall flag behind for
      // the parkour layer to consider next substep.
      p.vel.x = 0;
      p.wallContactSide = dx > 0 ? 1 : -1;
    } else {
      p.wallContactSide = 0;
    }
  } else {
    p.wallContactSide = 0;
  }

  // --- Ground contact ------------------------------------------------------
  const probe = p._ground;
  groundProbe(p.pos.x, p.pos.y + 0.05, p.pos.z, BODY.halfX, BODY.halfZ,
    MOVEMENT.groundProbeDepth, cs, candidates, n, probe);

  const falling = p.vel.y <= 0.001;
  if (probe.hit && falling && p.pos.y - probe.y <= MOVEMENT.groundSnapDistance) {
    if (!wasGrounded && p.landingImpact === 0) p.landingImpact = -p.vel.y;
    p.pos.y = probe.y;
    p.vel.y = 0;
    p.grounded = true;
    p.groundSurface = probe.surface;
    p.groundSlope = probe.slope;
    p.groundY = probe.y;
  } else if (!probe.hit || p.pos.y - probe.y > MOVEMENT.groundSnapDistance || p.vel.y > 0.001) {
    p.grounded = false;
    p.groundSlope = 0;
  }
}

export function crash(p, ev) {
  if (p.invulnTimer > 0) return;
  // One crash per contact. The runner is still touching the obstacle on the next
  // substep, and charging for that again turns a single mistake into sixty a
  // second - which pins the runner, spams the event queue, and reads as a bug.
  if (p.stumbleTimer > 0) return;
  if (p.shield > 0) {
    p.shield--;
    p.invulnTimer = 0.8;
    ev.push(EV.SHIELD_ABSORB, p.index);
    return;
  }
  p.speed *= 1 - PARKOUR.crashSpeedLoss;
  p.boostSpeed = 0;
  p.boostTimer = 0;
  p.combo = 0;
  p.stumbleTimer = PARKOUR.stumbleDuration;
  ev.push(EV.CRASH, p.index, p.speed);
  ev.push(EV.COMBO_RESET, p.index);
}
