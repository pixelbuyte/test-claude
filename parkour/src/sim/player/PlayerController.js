/**
 * Per-racer orchestration.
 *
 * The player and every AI opponent run through exactly this code path - the
 * only difference between them is who fills in the intent. That is deliberate:
 * an opponent that moves by different rules than the player is the fastest way
 * to make a race feel unfair, and it doubles the surface area to test.
 */
import { STEP, BODY, MOVEMENT, PARKOUR, RACE, POWERUPS } from '../../config.js';
import { STATE, STATE_INFO, isScripted, isTerminal } from './states.js';
import { makeAffordanceSet, sense } from './affordances.js';
import { integrate, resolve, currentHeight, HALF_TRACK, crash } from './MovementController.js';
import { parkourStep, stepScripted, setState } from './ParkourController.js';
import { makeAABB } from '../world/colliderSet.js';
import { makeSweepResult, makeGroundResult } from '../world/sweep.js';
import { EV } from '../core/events.js';
import { clamp } from '../math/scalar.js';

/** What one racer wants to do this substep. Filled by input or by the AI. */
export function makeIntent() {
  return {
    /** Desired track position, normalised to [-1, 1]. */
    lateralTarget: 0,
    jumpPressed: false,
    jumpHeld: false,
    slidePressed: false,
    slideHeld: false,
  };
}

/**
 * Edge-triggered flags are consumed by the first substep of a frame only, so a
 * single tap can never fire twice when the accumulator runs two substeps.
 */
export function consumeEdges(intent) {
  intent.jumpPressed = false;
  intent.slidePressed = false;
}

export function makeRacer(index, opts = {}) {
  return {
    index,
    isPlayer: opts.isPlayer === true,
    name: opts.name || `racer-${index}`,
    characterId: opts.characterId || 'runner-ember',
    skill: opts.skill || 'normal',
    color: opts.color || '#ff7a3d',

    pos: { x: 0, y: 0, z: 0 },
    prevPos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    pendingX: 0,
    targetX: 0,

    speed: 0,
    baseSpeed: MOVEMENT.speedStart,
    speedScale: opts.speedScale ?? 1,
    slowFactor: 1,
    boostSpeed: 0,
    boostTimer: 0,

    state: STATE.IDLE,
    prevState: STATE.IDLE,
    stateTime: 0,

    grounded: false,
    groundY: 0,
    groundSurface: 0,
    groundSlope: 0,
    landingImpact: 0,

    coyoteTimer: 0,
    jumpBuffer: 0,
    slideBuffer: 0,
    canDoubleJump: true,
    jumpCutApplied: false,
    slideTimer: 0,
    stumbleTimer: 0,
    /** Seconds spent unable to make forward progress. Resets the moment it does. */
    blockedTimer: 0,

    wallSide: 0,
    wallX: 0,
    wallLockout: 0,
    wallContactSide: 0,
    wallPushTimer: 0,
    wallPushDir: 0,
    launchCooldown: 0,

    vaultStartY: 0,
    vaultTopY: 0,
    vaultExitZ: 0,
    mantleStartY: 0,
    mantleTargetY: 0,

    laneMinX: -HALF_TRACK,
    laneMaxX: HALF_TRACK,

    combo: 0,
    comboTimer: 0,
    coins: 0,
    shards: 0,

    shield: 0,
    invulnTimer: 0,
    magnetTimer: 0,
    slowmoTimer: 0,
    speedTimer: 0,
    activePowerup: -1,
    powerupTimer: 0,
    heldPowerup: -1,

    checkpointIndex: -1,
    checkpoint: { x: 0, y: 0, z: 0, speed: 0 },
    deaths: 0,
    respawnTimer: 0,

    finished: false,
    finishTime: 0,
    placement: 0,
    progress: 0,
    raceTime: 0,
    timePenalty: 0,

    affordances: makeAffordanceSet(),
    _aabb: makeAABB(),
    _sweep: makeSweepResult(),
    _ground: makeGroundResult(),
    _springOut: new Float32Array(1),
  };
}

export function placeRacer(p, x, y, z) {
  p.pos.x = x; p.pos.y = y; p.pos.z = z;
  p.prevPos.x = x; p.prevPos.y = y; p.prevPos.z = z;
  p.pendingX = x;
  p.targetX = x;
  p.checkpoint.x = x; p.checkpoint.y = y; p.checkpoint.z = z;
  p.checkpoint.speed = 0;
  p.vel.x = 0; p.vel.y = 0; p.vel.z = 0;
}

/** One simulation substep for one racer. */
export function stepRacer(p, intent, world, ev) {
  if (isTerminal(p.state) || p.finished) return;

  p.prevPos.x = p.pos.x;
  p.prevPos.y = p.pos.y;
  p.prevPos.z = p.pos.z;
  p.stateTime += STEP;
  p.raceTime += STEP;

  if (p.state === STATE.DEAD) {
    p.respawnTimer -= STEP;
    if (p.respawnTimer <= 0) respawn(p, world, ev);
    return;
  }

  // --- Power-up and status timers -----------------------------------------
  if (p.invulnTimer > 0) p.invulnTimer -= STEP;
  if (p.powerupTimer > 0) {
    p.powerupTimer -= STEP;
    if (p.powerupTimer <= 0) {
      ev.push(EV.POWERUP_EXPIRE, p.index, p.activePowerup);
      p.activePowerup = -1;
      p.slowFactor = 1;
    }
  }

  // A long combo is worth a small, compounding speed edge - the reward for
  // stringing moves together rather than just surviving them.
  const comboBonus = 1 + Math.min(p.combo, 12) * 0.008;
  p.baseSpeed = world.baseSpeedAt(p.pos.z) * comboBonus * p.speedScale;
  if (p.speedTimer > 0) {
    p.speedTimer -= STEP;
    p.baseSpeed += POWERUPS.speed.speedBonus;
  }

  // Enforce the state table's duration cap so no state can wedge open.
  const info = STATE_INFO[p.state];
  if (info.maxDuration > 0 && p.stateTime > info.maxDuration + STEP) {
    setState(p, p.grounded ? STATE.RUN : STATE.FALL);
  }

  world.refresh(p.pos.z);

  integrate(p, intent, world);
  sense(p.affordances, world, p.pos.x, p.pos.y, p.pos.z, p.speed, currentHeight(p));
  parkourStep(p, intent, world, ev);

  if (isScripted(p.state)) stepScripted(p, world, ev);
  resolve(p, world, ev);

  // --- Hazards and falling -------------------------------------------------
  if (p.affordances.hazardTouch && p.invulnTimer <= 0) {
    if (p.shield > 0) {
      p.shield--;
      p.invulnTimer = 1.0;
      ev.push(EV.SHIELD_ABSORB, p.index);
    } else {
      die(p, world, ev);
      return;
    }
  }

  if (p.pos.y < world.floorAt(p.pos.z) - PARKOUR.fallDeathDepth) {
    die(p, world, ev);
    return;
  }

  // Wedged against geometry with no way through. A crash costs speed, which
  // makes the next attempt worse, so a runner that has been stuck this long is
  // not going to recover on its own - and a race cannot wait for it.
  if (p.blockedTimer > PARKOUR.stuckDeathTime) {
    die(p, world, ev);
    return;
  }

  world.collectTriggers(p, ev, currentHeight(p));

  const progress = world.progressOf(p.pos.z);
  if (progress > p.progress) p.progress = progress;
}

export function die(p, world, ev) {
  if (p.invulnTimer > 0 || p.state === STATE.DEAD) return;
  p.deaths++;
  p.combo = 0;
  p.boostSpeed = 0;
  p.boostTimer = 0;
  p.vel.x = 0; p.vel.y = 0; p.vel.z = 0;
  p.speed = 0;
  p.respawnTimer = 0.55;
  p.timePenalty += RACE.respawnPenaltySeconds;
  setState(p, STATE.DEAD);
  ev.push(EV.DEATH, p.index, p.deaths);
}

export function respawn(p, world, ev) {
  const cp = p.checkpoint;
  p.pos.x = cp.x;
  p.pos.y = cp.y;
  p.pos.z = cp.z;
  p.prevPos.x = cp.x; p.prevPos.y = cp.y; p.prevPos.z = cp.z;
  p.pendingX = cp.x;
  p.targetX = cp.x;
  p.vel.x = 0; p.vel.y = 0; p.vel.z = 0;
  // Restart at a fraction of the checkpoint speed: enough not to feel dead in
  // the water, little enough that dying still costs real time.
  p.speed = cp.speed * 0.8;
  p.grounded = false;
  p.wallSide = 0;
  p.wallLockout = 0;
  p.stumbleTimer = 0;
  p.slideTimer = 0;
  // Must clear, or a runner that died wedged respawns already most of the way
  // to dying again.
  p.blockedTimer = 0;
  p.jumpBuffer = 0;
  p.slideBuffer = 0;
  p.canDoubleJump = true;
  p.invulnTimer = RACE.respawnInvulnSeconds;
  setState(p, STATE.FALL);
  ev.push(EV.RESPAWN, p.index, p.checkpointIndex);
}

/** Records a checkpoint snapshot. Called by CheckpointManager on a CHECKPOINT event. */
export function saveCheckpoint(p, index, x, y, z) {
  p.checkpointIndex = index;
  p.checkpoint.x = x;
  p.checkpoint.y = y;
  p.checkpoint.z = z;
  p.checkpoint.speed = p.speed;
}

/** Applies a boost strip. Idempotent while the boost is already running. */
export function applyBoost(p, amount = 0, duration = 0) {
  const bonus = amount || 5;
  p.boostSpeed = Math.max(p.boostSpeed, bonus);
  p.boostTimer = Math.max(p.boostTimer, duration || 1.5);
}

export { crash, currentHeight, HALF_TRACK };
