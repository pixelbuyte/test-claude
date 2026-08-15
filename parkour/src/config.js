/**
 * Vertigo Rush - central tuning constants.
 *
 * This is the single source of truth for every gameplay number. The movement
 * controller reads it at runtime; the level validator reads it at build time to
 * derive what is physically reachable. Retuning a jump here automatically
 * re-validates every level instead of silently breaking one.
 *
 * Pure data. No imports, no side effects - safe for both browser and Node.
 */

/** Simulation runs at a fixed rate. Nothing anywhere takes a `dt` argument. */
export const STEP = 1 / 60;
export const MAX_SUBSTEPS = 6;
/** Largest frame delta we will accumulate; longer stalls are simply dropped. */
export const MAX_FRAME_DELTA = 0.1;

/** Axis convention: X lateral, Y up, Z forward (monotonically increasing). */
export const AXIS = { X: 0, Y: 1, Z: 2 };

export const BODY = {
  width: 0.55,
  depth: 0.55,
  height: 1.75,
  slideHeight: 0.85,
  /** Half-extents, precomputed - used every substep. */
  halfX: 0.275,
  halfZ: 0.275,
  /** Eye/camera anchor as a fraction of current height. */
  anchorY: 0.55,
};

export const MOVEMENT = {
  // Forward speed
  speedStart: 9,
  speedMin: 4,
  speedMax: 22,
  accelPerSec: 0.25,
  /** How fast actual speed chases target speed (units/s^2). */
  speedApproach: 6,

  // Gravity is asymmetric: floaty on the way up, snappy on the way down.
  gravityUp: -34,
  gravityDown: -46,
  terminalVelocity: -38,

  // Jumping
  jumpVelocity: 11.2,
  doubleJumpVelocity: 9.4,
  /** Releasing jump early cuts upward velocity to this fraction. */
  jumpCutFactor: 0.45,
  coyoteTime: 0.12,
  jumpBufferTime: 0.15,

  // Lateral
  laneWidth: 2.4,
  lateralAccel: 40,
  lateralDrag: 12,
  lateralMax: 12,
  /** Critically-damped spring frequency for lane snapping. */
  laneSpringOmega: 18,
  /** Lateral authority while airborne. */
  airControl: 0.55,

  // Ground handling
  groundSnapDistance: 0.25,
  groundProbeDepth: 0.4,
  /** Slope speed modifier: downhill adds, uphill subtracts. */
  slopeSpeedFactor: 6,
  maxStepUp: 0.35,
};

export const PARKOUR = {
  // Vault: hop over a low obstacle without losing speed.
  vaultMaxTop: 1.1,
  vaultMinTop: 0.3,
  vaultMaxDepth: 1.6,
  vaultDuration: 0.35,
  vaultMinSpeed: 6,
  vaultArcHeight: 0.55,

  // Slide: duck under a high obstacle.
  slideDuration: 0.75,
  slideSpeedBonus: 0.12,
  slideSpeedBonusTime: 0.3,
  slideDecayRate: 0.08,

  // Wall-run: cling to a side wall, gravity heavily reduced.
  wallMaxDistance: 0.45,
  wallRunMinSpeedFactor: 0.75,
  wallRunMaxTime: 1.4,
  wallRunGravityScale: 0.25,
  /** Gravity scale ramps from wallRunGravityScale back to 1 over this fraction. */
  wallRunGravityRampStart: 0.6,
  wallRunSpeedBonus: 0.06,
  wallMinHeight: 1.6,

  // Wall-jump: push off a wall being run or touched.
  wallJumpLateral: 7.5,
  wallJumpUp: 9.5,
  /** Time after a wall-jump during which the same wall cannot be re-grabbed. */
  wallJumpLockout: 0.25,

  // Ledge grab + mantle
  ledgeLatchTime: 0.25,
  mantleDuration: 0.4,
  ledgeMaxReach: 0.35,

  // Rails
  railEntryDistance: 2.0,
  railSpeedBonus: 0.04,

  // Launch pads
  launchDefaultImpulse: 13.5,

  /** Input within this window of an affordance becoming valid still counts. */
  triggerWindow: 0.15,

  // Failure
  crashSpeedLoss: 0.6,
  stumbleDuration: 0.5,
  /**
   * Blocked head-on for this long counts as wedged, and is resolved as a death
   * and a checkpoint respawn. Long enough that a recoverable stumble against a
   * vaultable crate resolves itself first, short enough that a race never waits.
   */
  stuckDeathTime: 1.4,
  /** Falling this far below the chunk floor is a death. */
  fallDeathDepth: 12,
};

export const BOOST = {
  padSpeedBonus: 5,
  padDuration: 1.5,
  /** Additive boost decays at this rate once the timer expires. */
  decayRate: 8,
};

export const POWERUPS = {
  speed: { duration: 6, speedBonus: 4 },
  shield: { duration: 12, absorbs: 1 },
  magnet: { duration: 8, radius: 7 },
  slowmo: { duration: 5, opponentScale: 0.62 },
  airboost: { duration: 0.001, impulse: 12 },
  invuln: { duration: 6 },
};

export const CAMERA = {
  boomNear: 6.2,
  boomFar: 7.6,
  height: 2.4,
  lookAheadBase: 4.5,
  lookAheadPerSpeed: 0.35,
  fovLandscape: 62,
  fovPortrait: 74,
  fovSpeedKick: 12,
  /** Critically-damped follow frequency. */
  followOmega: 9,
  lookOmega: 7,
  fovOmega: 4,
  /** Camera pulls in fast when blocked, eases back out slowly. */
  clipPullInTime: 0.02,
  clipPushOutTime: 0.35,
  clipRadius: 0.45,
  clipSamples: 4,
  shakeDecay: 6,
  shakeLand: 0.35,
  shakeCrash: 0.8,
  shakeBoost: 0.25,
  anticipationStrength: 1.6,
  near: 0.1,
  far: 320,
};

export const RACE = {
  countdownSeconds: 3,
  /** A racer that has not finished this long after the leader is a DNF. */
  dnfGraceSeconds: 45,
  /** Hard cap on race length (ticks) so a stuck sim cannot hang forever. */
  maxTicks: 60 * 300,
  respawnPenaltySeconds: 1.5,
  respawnInvulnSeconds: 1.0,
};

export const AI = {
  easy: {
    reactionTime: 0.34, laneError: 0.55, jumpTiming: 0.13,
    riskAppetite: 0.15, mistakeChance: 0.20, recoverySkill: 0.5, speedScale: 0.90,
  },
  normal: {
    reactionTime: 0.20, laneError: 0.30, jumpTiming: 0.075,
    riskAppetite: 0.45, mistakeChance: 0.10, recoverySkill: 0.75, speedScale: 0.97,
  },
  hard: {
    reactionTime: 0.11, laneError: 0.14, jumpTiming: 0.04,
    riskAppetite: 0.80, mistakeChance: 0.045, recoverySkill: 0.95, speedScale: 1.03,
  },
  /** Optional pack cohesion. Disabled by default - a fair race is the default. */
  rubberBandMax: 0.08,
  rubberBandEnabled: false,
  recoveryTime: 1.2,
};

export const LEVEL = {
  bucketSize: 4,
  /** Fixed-capacity scratch buffer for every broadphase query. */
  queryCapacity: 64,
  laneCount: 3,
  checkpointEveryChunks: 4,
  /** Guaranteed-admissible fallback when no candidate chunk fits. */
  fallbackChunkId: 'run-neutral',
  maxConsecutiveSameTag: 2,
  forkEveryMin: 5,
  restAfterHardStreak: 3,
};

export const QUALITY = {
  low: {
    pixelRatioCap: 1.0, antialias: false, shadows: false,
    particleBudget: 300, streamAhead: 100, decorBand: 40, trailSegments: 8,
    maxOpponentsRendered: 3,
  },
  medium: {
    pixelRatioCap: 1.5, antialias: true, shadows: false,
    particleBudget: 900, streamAhead: 140, decorBand: 70, trailSegments: 14,
    maxOpponentsRendered: 5,
  },
  high: {
    pixelRatioCap: 2.0, antialias: true, shadows: true,
    particleBudget: 2000, streamAhead: 180, decorBand: 100, trailSegments: 20,
    maxOpponentsRendered: 8,
  },
  /** Adaptive downgrade: sustained frame time above this drops a tier. */
  downgradeFrameMs: 22,
  downgradeSustainSeconds: 2,
  maxAutoDowngrades: 2,
  /** Distance past which an opponent renders as a two-box impostor. */
  impostorDistance: 35,
};

export const PROGRESSION = {
  xpPerPlacement: [140, 100, 75, 55, 40],
  xpPerCoin: 1,
  xpFinishBonus: 60,
  coinsPerPlacement: [120, 85, 60, 45, 30],
  /** XP needed for level N is base * N^exponent. */
  xpCurveBase: 220,
  xpCurveExponent: 1.35,
  maxPlayerLevel: 40,
};

/** Collider kinds. Stored as Uint8 in the SoA collider set. */
export const KIND = {
  SOLID: 0,
  RAMP: 1,
  WALLRUNNABLE: 2,
  VAULTABLE: 3,
  RAIL: 4,
  PLATFORM: 5,
  TRIGGER: 6,
};

/** Collider flags. Stored as Uint16 bitmask. */
export const FLAG = {
  ONE_WAY: 1 << 0,
  HAZARD: 1 << 1,
  BOOST: 1 << 2,
  BREAKABLE: 1 << 3,
  NO_WALLRUN: 1 << 4,
  MOVING: 1 << 5,
  FINISH: 1 << 6,
  CHECKPOINT: 1 << 7,
  /** A RAMP whose surface falls (rather than rises) along +Z. */
  RAMP_DESC: 1 << 8,
  /** Collectible / powerup trigger rather than a level trigger. */
  PICKUP: 1 << 9,
};

/** Bitmask over KIND values, for broadphase filtering. */
export function kindMask(...kinds) {
  let m = 0;
  for (const k of kinds) m |= 1 << k;
  return m;
}

/** Surface ids drive footstep timbre, friction and dust colour. */
export const SURFACE = {
  CONCRETE: 0,
  METAL: 1,
  WOOD: 2,
  GLASS: 3,
  GRATE: 4,
};

/**
 * Analytic reachability helpers. The level validator uses these to prove every
 * authored and generated gap is clearable, so a physics retune surfaces as a
 * failing test rather than an unplayable level.
 */
export function apexHeight(v0 = MOVEMENT.jumpVelocity) {
  return (v0 * v0) / (2 * -MOVEMENT.gravityUp);
}

/** Time from launch at v0 until falling back to the same height. */
export function airTime(v0 = MOVEMENT.jumpVelocity) {
  const up = v0 / -MOVEMENT.gravityUp;
  const h = apexHeight(v0);
  const down = Math.sqrt((2 * h) / -MOVEMENT.gravityDown);
  return up + down;
}

/** Horizontal distance clearable from a single jump at forward speed v. */
export function maxGapAtSpeed(v, v0 = MOVEMENT.jumpVelocity) {
  return v * airTime(v0);
}

/** Distance clearable using jump then double jump - the risky-route budget. */
export function maxGapWithDoubleJump(v) {
  const first = airTime(MOVEMENT.jumpVelocity) * 0.55;
  const second = airTime(MOVEMENT.doubleJumpVelocity);
  return v * (first + second);
}

/** How far a wall-run can carry the player at speed v. */
export function maxWallRunLength(v) {
  return v * PARKOUR.wallRunMaxTime;
}

/** Highest ledge reachable from the ground at a standing jump. */
export function maxStepUpHeight() {
  return apexHeight() - 0.15;
}
