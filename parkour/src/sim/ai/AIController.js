/**
 * Opponent brains.
 *
 * An opponent fills in exactly the same intent object the player's thumb does,
 * and is then advanced by exactly the same `stepRacer`. Nothing about an AI racer
 * is privileged: it obeys the same gravity, crashes into the same crates, and
 * loses the same 60% of its speed for doing so.
 *
 * That constraint is deliberate. An opponent that moved by different rules is the
 * fastest way to make a race feel unfair, and it would double the amount of
 * movement code that has to be kept correct. The only thing skill changes is the
 * quality and timing of the decisions - never the physics they feed into.
 *
 * All randomness comes from a named seeded stream, so a replay of the same race
 * produces the same opponents making the same mistakes.
 */
import { STEP, AI, PARKOUR, MOVEMENT } from '../../config.js';
import { Rng } from '../math/prng.js';
import { makeIntent, makeRacer } from '../player/PlayerController.js';
import { STATE } from '../player/states.js';
import { clamp } from '../math/scalar.js';

export function makeAI(racer, opts = {}) {
  const profile = AI[opts.skill || racer.skill || 'normal'] || AI.normal;
  return {
    racer,
    profile,
    rng: new Rng(opts.seed ?? 1, `ai:${racer.name}:${racer.index}`),
    intent: makeIntent(),

    /** Personality: how far from centre this racer likes to sit. */
    laneBias: 0,
    /** Fixed appetite for leaving the racing line to collect. Set once. */
    greed: 0,
    /** Current steering goal in [-1, 1], before error is added. */
    laneGoal: 0,
    /** Countdown until this racer is allowed to react to what it just saw. */
    reactionTimer: 0,
    /** Non-zero while deliberately fumbling. */
    mistakeTimer: 0,
    /** Blocks re-deciding a jump every substep while one is already committed. */
    commitTimer: 0,

    /** Smoothed lane error, so the wobble looks like a person, not like noise. */
    errorPhase: 0,
    errorRate: 0,
  };
}

/**
 * Fills `ai.intent` for this substep.
 *
 * @returns the intent, ready to hand to stepRacer
 */
export function thinkAI(ai, world) {
  const p = ai.racer;
  const a = p.affordances;
  const prof = ai.profile;
  const intent = ai.intent;

  intent.jumpPressed = false;
  intent.slidePressed = false;

  if (p.finished) {
    intent.jumpHeld = false;
    intent.slideHeld = false;
    intent.lateralTarget = 0;
    return intent;
  }

  // --- Timers --------------------------------------------------------------
  if (ai.reactionTimer > 0) ai.reactionTimer -= STEP;
  if (ai.commitTimer > 0) ai.commitTimer -= STEP;
  if (ai.mistakeTimer > 0) ai.mistakeTimer -= STEP;

  // --- Deliberate mistakes -------------------------------------------------
  // A field that never errs is not a race, it is a demo. Mistakes are sampled
  // rarely and then recovered from at a rate set by the profile, so a weaker
  // opponent both errs more often and takes longer to sort itself out.
  if (ai.mistakeTimer <= 0 && ai.rng.chance(prof.mistakeChance * STEP)) {
    ai.mistakeTimer = AI.recoveryTime * (2 - prof.recoverySkill);
  }
  const fumbling = ai.mistakeTimer > 0;

  // --- Steering ------------------------------------------------------------
  ai.errorPhase += STEP * (0.7 + prof.laneError);
  const wobble = Math.sin(ai.errorPhase * 2.1) * prof.laneError * 0.5;

  let goal = ai.laneBias;

  // Coins are worth leaving the racing line for, but only for a racer with the
  // appetite for it - a cautious opponent stays on line and finishes cleaner.
  // Whether this racer detours for coins is a fixed trait, not a per-substep
  // coin flip - re-rolling it every substep would make the steering flicker.
  if (ai.greed > 0.45) {
    const lure = nearestPickupX(world, p, 18);
    if (lure !== null) goal = clamp(lure / 2.4, -1, 1);
  }

  // A wall-run is the fast line where one is available and the racer is bold.
  if ((a.wallLeftValid || a.wallRightValid) && prof.riskAppetite > 0.35
      && p.speed > p.baseSpeed * PARKOUR.wallRunMinSpeedFactor) {
    goal = a.wallLeftValid ? -1 : 1;
  }

  if (fumbling) goal = clamp(goal + (ai.rng.float() - 0.5) * 1.6, -1, 1);

  ai.laneGoal = goal;
  intent.lateralTarget = clamp(goal + wobble, -1, 1);

  // --- Jumping -------------------------------------------------------------
  // Everything below is a decision about *when*, not *whether*: the affordance
  // system has already established that the move is possible.
  const jitter = (ai.rng.float() - 0.5) * 2 * prof.jumpTiming;
  const readyToAct = ai.reactionTimer <= 0 && ai.commitTimer <= 0 && !fumbling;

  let wantJump = false;

  // A hole in the floor. Jump when the far edge is within reach at this speed,
  // biased by the profile's timing error so weaker racers jump early or late.
  if (a.gapDistance > 0 && a.gapDistance < 30) {
    const leadTime = 0.16 + jitter;
    const leadDistance = Math.max(0.6, p.speed * leadTime);
    if (a.gapDistance <= leadDistance && p.grounded) wantJump = true;
  }

  // Airborne next to a wall, with the speed to hold it: take the wall.
  if (!p.grounded && (a.wallLeftValid || a.wallRightValid)
      && p.state !== STATE.WALLRUN && prof.riskAppetite > 0.35) {
    wantJump = true;
  }

  // Wall-running has to end in a wall-jump, or it ends in a fall.
  if (p.state === STATE.WALLRUN && p.stateTime > PARKOUR.wallRunMaxTime * 0.62) {
    wantJump = true;
  }

  // A blocker that cannot be vaulted has to be gone over.
  if (a.blockerValid && p.grounded && !a.vaultValid) wantJump = true;

  if (wantJump && readyToAct) {
    intent.jumpPressed = true;
    intent.jumpHeld = true;
    ai.commitTimer = 0.18;
    ai.reactionTimer = prof.reactionTime * 0.5;
  } else if (p.vel.y <= 0) {
    // Releasing at the top is what makes an AI arc look controlled rather than
    // maximal - it uses the same jump-cut the player does.
    intent.jumpHeld = false;
  }

  // --- Sliding -------------------------------------------------------------
  // `slideNeeded` is already a proximity signal - the forward probe only reaches
  // a little over a metre - so there is nothing to lead here. What separates a
  // strong racer from a weak one is reaction time and whether it is mid-fumble.
  if (a.slideNeeded && p.grounded) {
    if (ai.reactionTimer <= 0 && !fumbling) {
      intent.slidePressed = true;
      intent.slideHeld = true;
    }
  } else if (p.state !== STATE.SLIDE) {
    intent.slideHeld = false;
  }

  return intent;
}

/** X of the nearest uncollected pickup ahead, or null. */
function nearestPickupX(world, p, range) {
  let bestZ = Infinity;
  let bestX = null;
  const pickups = world.pickups;
  for (let i = 0; i < pickups.length; i++) {
    if (world.pickupTaken[i]) continue;
    const dz = pickups[i].z - p.pos.z;
    if (dz < 1 || dz > range) continue;
    if (dz < bestZ) {
      bestZ = dz;
      bestX = pickups[i].x;
    }
  }
  return bestX;
}

/**
 * Builds a field of opponents.
 *
 * @param {object[]} roster  [{ name, skill, characterId, color }]
 * @param {number} seed      the level's seed; opponents draw from named streams
 *                           off it, so adding one cannot perturb another
 */
export function makeField(roster, seed) {
  const field = [];
  for (let i = 0; i < roster.length; i++) {
    const def = roster[i];
    const skill = def.skill || 'normal';
    const racer = makeRacer(i + 1, {
      name: def.name,
      skill,
      characterId: def.characterId,
      color: def.color,
      speedScale: (AI[skill] || AI.normal).speedScale,
    });
    const ai = makeAI(racer, { seed, skill });
    // Spread the field across the track so they do not start stacked.
    ai.laneBias = clamp((i % 3) - 1, -1, 1) * 0.7;
    ai.greed = ai.rng.range(0, 1) * (0.4 + ai.profile.riskAppetite);
    field.push(ai);
  }
  return field;
}
