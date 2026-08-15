/**
 * The parkour state machine.
 *
 * `affordances.js` reports what is physically nearby; this file decides what to
 * do about it. The central promise is that the player never needs pixel-perfect
 * timing:
 *
 *   - Free actions (vault, mantle, rail entry, launch pad) fire on their own as
 *     long as the runner has the speed for them.
 *   - Hard actions (double jump, wall-jump, slide) need input, but a press is
 *     buffered for 0.15 s and a takeoff is forgiven for 0.12 s after leaving the
 *     ground, so early and late inputs both land.
 *   - One button is contextual: a swipe-up becomes a vault, a wall-jump or a
 *     plain jump depending on what is in front of the runner at that instant.
 */
import { STEP, MOVEMENT, PARKOUR, BOOST, BODY } from '../../config.js';
import { STATE, STATE_INFO } from './states.js';
import { EV } from '../core/events.js';
import { clamp } from '../math/scalar.js';

export function setState(p, next) {
  if (p.state === next) return;
  p.prevState = p.state;
  p.state = next;
  p.stateTime = 0;
}

/** Combo rewards chaining parkour moves without touching plain ground. */
function scoreMove(p, ev) {
  p.combo++;
  p.comboTimer = 2.5;
  ev.push(EV.COMBO_UP, p.index, p.combo);
}

function beginJump(p, ev, velocity, type) {
  p.vel.y = velocity;
  p.grounded = false;
  p.jumpBuffer = 0;
  p.coyoteTimer = 0;
  p.jumpCutApplied = false;
  setState(p, STATE.JUMP);
  ev.push(type, p.index, velocity);
}

function beginVault(p, a, ev) {
  p.vaultStartY = p.pos.y;
  p.vaultTopY = a.vaultTop;
  p.vaultExitZ = a.vaultExitZ;
  p.jumpBuffer = 0;
  setState(p, STATE.VAULT);
  scoreMove(p, ev);
  ev.push(EV.VAULT, p.index, p.speed);
}

function beginWallRun(p, side, wallX, ev) {
  p.wallSide = side;
  p.wallX = wallX;
  p.canDoubleJump = true;
  // Wall-running kills downward momentum - grabbing the wall is the point.
  if (p.vel.y < 0) p.vel.y *= 0.25;
  setState(p, STATE.WALLRUN);
  scoreMove(p, ev);
  ev.push(EV.WALLRUN_START, p.index, side);
}

function endWallRun(p, ev) {
  p.wallLockout = PARKOUR.wallJumpLockout;
  p.wallSide = 0;
  ev.push(EV.WALLRUN_END, p.index);
}

function beginWallJump(p, ev) {
  const side = p.wallSide || -Math.sign(p.wallContactSide || 1);
  p.vel.y = PARKOUR.wallJumpUp;
  p.vel.x = -side * PARKOUR.wallJumpLateral;
  // Push the lateral target off the wall too, or the spring drags us straight back.
  p.wallPushTimer = 0.22;
  p.wallPushDir = -side;
  p.wallLockout = PARKOUR.wallJumpLockout;
  p.wallSide = 0;
  p.canDoubleJump = true;
  p.jumpBuffer = 0;
  p.jumpCutApplied = false;
  setState(p, STATE.WALLJUMP);
  scoreMove(p, ev);
  ev.push(EV.WALL_JUMP, p.index, side);
}

function beginSlide(p, ev) {
  p.slideTimer = PARKOUR.slideDuration;
  p.slideBuffer = 0;
  p.boostSpeed += p.speed * PARKOUR.slideSpeedBonus;
  p.boostTimer = Math.max(p.boostTimer, PARKOUR.slideSpeedBonusTime);
  setState(p, STATE.SLIDE);
  ev.push(EV.SLIDE_START, p.index);
}

function beginMantle(p, a, ev) {
  p.mantleStartY = p.pos.y;
  p.mantleTargetY = a.ledgeY;
  setState(p, STATE.MANTLE);
  scoreMove(p, ev);
  ev.push(EV.MANTLE, p.index);
}

/**
 * One substep of decision-making. Runs after velocity integration and affordance
 * sensing, before collision resolution, so any impulse it injects is resolved
 * against the world in the same substep.
 */
export function parkourStep(p, intent, world, ev) {
  const a = p.affordances;
  const info = STATE_INFO[p.state];

  // --- Input buffers and forgiveness windows -------------------------------
  if (intent.jumpPressed) p.jumpBuffer = MOVEMENT.jumpBufferTime;
  else p.jumpBuffer = Math.max(0, p.jumpBuffer - STEP);

  if (intent.slidePressed) p.slideBuffer = MOVEMENT.jumpBufferTime;
  else p.slideBuffer = Math.max(0, p.slideBuffer - STEP);

  if (p.grounded) {
    p.coyoteTimer = MOVEMENT.coyoteTime;
    p.canDoubleJump = true;
  } else {
    p.coyoteTimer = Math.max(0, p.coyoteTimer - STEP);
  }

  p.wallLockout = Math.max(0, p.wallLockout - STEP);
  p.wallPushTimer = Math.max(0, p.wallPushTimer - STEP);
  p.launchCooldown = Math.max(0, p.launchCooldown - STEP);
  if (p.comboTimer > 0) {
    p.comboTimer -= STEP;
    if (p.comboTimer <= 0 && p.combo > 0) {
      p.combo = 0;
      ev.push(EV.COMBO_RESET, p.index);
    }
  }

  // Releasing the jump button early cuts the arc short - the single biggest
  // contributor to a jump feeling controllable rather than fixed.
  if (!info.scripted && !intent.jumpHeld && p.vel.y > 0 && !p.jumpCutApplied) {
    p.vel.y *= MOVEMENT.jumpCutFactor;
    p.jumpCutApplied = true;
  }

  if (info.scripted) return;

  // --- Stumble recovery ----------------------------------------------------
  if (p.stumbleTimer > 0) {
    p.stumbleTimer -= STEP;
    if (p.grounded && p.state !== STATE.STUMBLE) setState(p, STATE.STUMBLE);
    if (p.stumbleTimer <= 0 && p.state === STATE.STUMBLE) setState(p, STATE.RUN);
  }

  // --- Launch pads: a free action, always automatic -------------------------
  if (a.launchValid && p.grounded && p.launchCooldown <= 0) {
    p.vel.y = PARKOUR.launchDefaultImpulse;
    p.grounded = false;
    p.launchCooldown = 0.4;
    p.canDoubleJump = true;
    p.jumpCutApplied = true; // a pad's arc is the pad's business, not the button's
    setState(p, STATE.JUMP);
    scoreMove(p, ev);
    ev.push(EV.LAUNCH_PAD, p.index);
    return;
  }

  // --- Wall-run maintenance ------------------------------------------------
  if (p.state === STATE.WALLRUN) {
    const stillOnWall = p.wallSide < 0 ? a.wallLeftValid : a.wallRightValid;
    if (p.jumpBuffer > 0) {
      beginWallJump(p, ev);
      return;
    }
    if (!stillOnWall || p.stateTime >= PARKOUR.wallRunMaxTime || p.grounded) {
      endWallRun(p, ev);
      setState(p, p.grounded ? STATE.RUN : STATE.FALL);
    } else {
      // Hug the wall so the runner tracks it instead of drifting off.
      const target = p.wallSide < 0
        ? a.wallLeftX + BODY.halfX + 0.02
        : a.wallRightX - BODY.halfX - 0.02;
      p.pendingX = target;
      p.wallX = target;
      return;
    }
  }

  // --- Contextual jump -----------------------------------------------------
  if (p.jumpBuffer > 0) {
    if (a.vaultValid && (p.grounded || p.coyoteTimer > 0)) {
      beginVault(p, a, ev);
      return;
    }
    if (!p.grounded && p.wallLockout <= 0 && canWallRun(p, a)) {
      const side = a.wallLeftValid ? -1 : 1;
      beginWallRun(p, side, side < 0 ? a.wallLeftX : a.wallRightX, ev);
      return;
    }
    if (!p.grounded && p.coyoteTimer <= 0 && touchingWall(p, a) && p.wallLockout <= 0) {
      beginWallJump(p, ev);
      return;
    }
    if (p.grounded || p.coyoteTimer > 0) {
      beginJump(p, ev, MOVEMENT.jumpVelocity, EV.JUMP);
      return;
    }
    if (p.canDoubleJump) {
      p.canDoubleJump = false;
      beginJump(p, ev, MOVEMENT.doubleJumpVelocity, EV.DOUBLE_JUMP);
      scoreMove(p, ev);
      return;
    }
  }

  // --- Free actions --------------------------------------------------------
  // A vault fires without any input at all, provided the runner has the speed.
  if (a.vaultValid && p.grounded && p.speed >= PARKOUR.vaultMinSpeed) {
    beginVault(p, a, ev);
    return;
  }

  // Mantling a ledge you are already falling past is free too.
  if (a.ledgeValid && !p.grounded && p.vel.y <= 1 && p.state !== STATE.MANTLE) {
    beginMantle(p, a, ev);
    return;
  }

  // Steering into a wall while airborne starts a wall-run without a button.
  if (!p.grounded && p.wallLockout <= 0 && canWallRun(p, a) && steeringIntoWall(intent, a)) {
    const side = a.wallLeftValid ? -1 : 1;
    beginWallRun(p, side, side < 0 ? a.wallLeftX : a.wallRightX, ev);
    return;
  }

  // --- Slide ---------------------------------------------------------------
  if (p.state === STATE.SLIDE) {
    p.slideTimer -= STEP;
    // Holding the input extends the slide; releasing ends it early, unless
    // there is still something overhead to duck under.
    const wantsMore = intent.slideHeld && p.slideTimer > -0.4;
    if ((p.slideTimer <= 0 && !wantsMore) || !p.grounded) {
      ev.push(EV.SLIDE_END, p.index);
      setState(p, p.grounded ? STATE.RUN : STATE.FALL);
    }
    return;
  }
  if (p.slideBuffer > 0 && p.grounded) {
    beginSlide(p, ev);
    return;
  }

  // --- Ground / air bookkeeping --------------------------------------------
  if (p.grounded) {
    if (p.state === STATE.JUMP || p.state === STATE.FALL
      || p.state === STATE.WALLJUMP || p.state === STATE.WALLRUN) {
      setState(p, STATE.LAND);
      ev.push(EV.LAND, p.index, p.landingImpact, p.groundSurface);
      p.landingImpact = 0;
    } else if (p.state === STATE.LAND && p.stateTime >= STATE_INFO[STATE.LAND].maxDuration) {
      setState(p, STATE.RUN);
    } else if (p.state === STATE.IDLE && p.speed > 1) {
      setState(p, STATE.RUN);
    } else if (p.state === STATE.RUN && p.speed > MOVEMENT.speedMax * 0.82) {
      setState(p, STATE.SPRINT);
    } else if (p.state === STATE.SPRINT && p.speed < MOVEMENT.speedMax * 0.72) {
      setState(p, STATE.RUN);
    }
  } else if (p.vel.y < 0 && p.state !== STATE.FALL && p.state !== STATE.WALLRUN) {
    setState(p, STATE.FALL);
  }
}

function canWallRun(p, a) {
  if (!(a.wallLeftValid || a.wallRightValid)) return false;
  return p.speed >= p.baseSpeed * PARKOUR.wallRunMinSpeedFactor;
}

function touchingWall(p, a) {
  return a.wallLeftValid || a.wallRightValid || p.wallContactSide !== 0;
}

function steeringIntoWall(intent, a) {
  if (a.wallLeftValid && intent.lateralTarget < -0.15) return true;
  if (a.wallRightValid && intent.lateralTarget > 0.15) return true;
  return false;
}

/**
 * Advances the scripted states. These drive position from a curve rather than
 * from gravity, so the motion and the animation are guaranteed to agree - the
 * runner's hand lands on the crate it is vaulting because both read the same
 * parameter.
 */
export function stepScripted(p, world, ev) {
  const info = STATE_INFO[p.state];
  const t = info.maxDuration > 0 ? clamp(p.stateTime / info.maxDuration, 0, 1) : 1;

  switch (p.state) {
    case STATE.VAULT: {
      // Rise over the obstacle and settle on the far side. The base rises on a
      // square-root curve rather than linearly because the obstacle is reached
      // early in the move - a linear rise clips the body through the very thing
      // it is vaulting.
      const exitY = Math.max(p.vaultStartY, p.vaultTopY);
      const base = p.vaultStartY + (exitY - p.vaultStartY) * Math.sqrt(t);
      p.pos.y = base + Math.sin(Math.PI * t) * PARKOUR.vaultArcHeight;
      p.pos.z += p.vel.z * STEP;
      p.pos.x = p.pendingX;
      if (t >= 1) {
        p.vel.y = 0;
        setState(p, STATE.FALL);
      }
      break;
    }
    case STATE.MANTLE: {
      p.pos.y = p.mantleStartY + (p.mantleTargetY - p.mantleStartY) * t;
      p.pos.z += p.vel.z * STEP * 0.65;
      p.pos.x = p.pendingX;
      if (t >= 1) {
        p.vel.y = 0;
        p.grounded = true;
        setState(p, STATE.LAND);
      }
      break;
    }
    case STATE.LEDGE: {
      if (t >= 1) setState(p, STATE.MANTLE);
      break;
    }
    case STATE.DEAD: {
      // Freeze in place; RaceManager handles the respawn timer.
      break;
    }
    default:
      break;
  }
}
