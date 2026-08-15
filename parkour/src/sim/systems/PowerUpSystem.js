/**
 * Power-ups.
 *
 * One place decides what a pickup *means*. `World.collectTriggers` only reports
 * that a trigger was touched; this turns that into an effect, owns its duration,
 * and ends it cleanly. Keeping that split is what stops power-up rules leaking
 * into collision code, where they would be untestable.
 *
 * The rule that matters most: **slow-mo scales the opponents' speed, never the
 * timestep.** Scaling `dt` would desynchronise the fixed step, break the
 * determinism checksum, and make recorded times incomparable. A power-up is
 * allowed to change what racers do; it is never allowed to change how time
 * advances.
 */
import { STEP, POWERUPS } from '../../config.js';
import { applyMagnet } from '../world/World.js';

/** Power-up kinds, as stored in the pickup table and on the racer. */
export const POWERUP = {
  SPEED: 0,
  SHIELD: 1,
  MAGNET: 2,
  SLOWMO: 3,
  AIRBOOST: 4,
  INVULN: 5,
};

export const POWERUP_NAME = ['speed', 'shield', 'magnet', 'slowmo', 'airboost', 'invuln'];

/** Maps the name a level author writes to the id the simulation stores. */
export function powerupId(name) {
  const i = POWERUP_NAME.indexOf(name);
  return i >= 0 ? i : POWERUP.SPEED;
}

function config(kind) {
  return POWERUPS[POWERUP_NAME[kind]] || POWERUPS.speed;
}

/**
 * Grants a power-up to a racer.
 *
 * Deliberately pushes no event. The world already emitted POWERUP_PICKUP when
 * the trigger was touched; emitting a second one of the same type with a
 * different payload meaning is how a consumer ends up double-counting. The
 * caller annotates that existing record with the kind instead.
 *
 * Effects that are instantaneous (air-boost) apply immediately and never become
 * the "active" power-up, so they cannot displace a shield the player is holding.
 *
 * @returns the kind granted
 */
export function grant(p, kind) {
  const cfg = config(kind);

  switch (kind) {
    case POWERUP.AIRBOOST:
      // Instant: a second wind mid-air, and it refreshes the double jump.
      p.vel.y = Math.max(p.vel.y, POWERUPS.airboost.impulse);
      p.canDoubleJump = true;
      p.jumpCutApplied = true;
      p.grounded = false;
      return kind;

    case POWERUP.SHIELD:
      // Stacks as a count rather than a timer: a shield is one absorbed crash,
      // and picking a second one up should mean two, not a longer first one.
      p.shield = Math.min(p.shield + POWERUPS.shield.absorbs, 3);
      break;

    case POWERUP.SPEED:
      p.speedTimer = Math.max(p.speedTimer, cfg.duration);
      break;

    case POWERUP.MAGNET:
      p.magnetTimer = Math.max(p.magnetTimer, cfg.duration);
      break;

    case POWERUP.SLOWMO:
      p.slowmoTimer = Math.max(p.slowmoTimer, cfg.duration);
      break;

    case POWERUP.INVULN:
      p.invulnTimer = Math.max(p.invulnTimer, cfg.duration);
      break;

    default:
      break;
  }

  p.activePowerup = kind;
  p.powerupTimer = Math.max(p.powerupTimer, cfg.duration);
  return kind;
}

/**
 * Advances every racer's power-up state for one substep.
 *
 * Runs after the racers have stepped, because the effects that matter here -
 * magnet range, slow-mo on opponents - depend on where everybody ended up.
 *
 * @param {object[]} racers  the whole field
 * @param {object} player    the racer whose slow-mo affects the others
 */
export function stepPowerUps(racers, player, world, ev) {
  for (let i = 0; i < racers.length; i++) {
    const p = racers[i];

    if (p.magnetTimer > 0) {
      p.magnetTimer -= STEP;
      const pulled = applyMagnet(world, p, POWERUPS.magnet.radius, ev);
      if (pulled > 0) p.magnetPulls = (p.magnetPulls || 0) + pulled;
    }

    if (p.slowmoTimer > 0) p.slowmoTimer -= STEP;
  }

  // Slow-mo is the only power-up that reaches across racers. It scales what the
  // opponents do, inside the same fixed step everybody else runs in.
  const slowing = player.slowmoTimer > 0;
  for (let i = 0; i < racers.length; i++) {
    const p = racers[i];
    if (p === player) continue;
    p.slowFactor = slowing ? POWERUPS.slowmo.opponentScale : 1;
  }
}

/**
 * Resolves a POWERUP_PICKUP trigger into an actual grant.
 *
 * The world reports the pickup index; the pickup table says which kind it was.
 */
export function collectPowerup(p, world, pickupIndex) {
  const pick = world.pickups[pickupIndex];
  if (!pick) return -1;
  const kind = typeof pick.powerup === 'string' ? powerupId(pick.powerup) : (pick.powerup ?? 0);
  return grant(p, kind);
}

/** Clears every power-up effect - used on respawn and between races. */
export function clearPowerUps(p) {
  p.shield = 0;
  p.magnetTimer = 0;
  p.slowmoTimer = 0;
  p.speedTimer = 0;
  p.powerupTimer = 0;
  p.activePowerup = -1;
  p.slowFactor = 1;
}

/** What the HUD needs to draw the power-up indicator. */
export function activeEffects(p) {
  return {
    shield: p.shield,
    speed: p.speedTimer > 0 ? p.speedTimer : 0,
    magnet: p.magnetTimer > 0 ? p.magnetTimer : 0,
    slowmo: p.slowmoTimer > 0 ? p.slowmoTimer : 0,
    invuln: p.invulnTimer > 0 ? p.invulnTimer : 0,
  };
}
