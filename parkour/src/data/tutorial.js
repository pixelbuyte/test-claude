/**
 * The tutorial, as five sentences and five predicates.
 *
 * A list of controls on the menu is read once, by someone who has not yet seen
 * a wall to run along, and forgotten before the countdown ends. So the game
 * teaches each move at the only moment the explanation means anything: the
 * first time the player is actually standing in front of one.
 *
 * Each hint's `when` is a pure predicate over the same affordance set the
 * parkour state machine reads, which is what keeps the two honest with each
 * other - the wall-run hint fires under exactly the conditions that would let a
 * wall-run start, so it can never promise a move the runner cannot make.
 *
 * Pure data and pure functions. No DOM, no toast, no save file.
 */
import { PARKOUR } from '../config.js';

/**
 * Ordered by how much the moment depends on the player doing something. If two
 * hints come true on the same substep the more time-critical one wins, because
 * the other will come round again - a vault will not.
 */
export const TUTORIAL_HINTS = [
  {
    id: 'slide',
    text: 'Swipe down to slide under it',
    when: (a) => a.slideNeeded,
  },
  {
    id: 'gap',
    text: 'Swipe up or tap to jump the gap',
    // `gapValid`, not `gapDistance > 0` - the probe reports its own range when
    // it finds nothing, so the latter is true on solid ground.
    when: (a, p) => a.gapValid && p.grounded,
  },
  {
    id: 'wallrun',
    // Mirrors canWallRun in ParkourController: airborne, beside a runnable
    // wall, with the speed to hold it. Promising a wall-run the runner is too
    // slow to start would teach the player the move does not work.
    text: 'Steer into the wall to run along it',
    when: (a, p) => !p.grounded
      && (a.wallLeftValid || a.wallRightValid)
      && p.speed >= p.baseSpeed * PARKOUR.wallRunMinSpeedFactor,
  },
  {
    id: 'vault',
    // A free action, so this is telling the player *not* to do something -
    // which is worth saying, or they will jump and lose the speed the vault
    // would have kept.
    text: 'Vaults are automatic - keep your speed up',
    when: (a, p) => a.vaultIndex >= 0 && p.grounded,
  },
  {
    id: 'launch',
    // There is no affordance for a launch pad ahead, only one underfoot, so
    // this necessarily arrives as the pad fires rather than before it. Worded
    // to explain what just happened instead of to ask for an input.
    text: 'Launch pad - it fires on its own',
    when: (a) => a.launchValid,
  },
];

export const TUTORIAL_IDS = TUTORIAL_HINTS.map((h) => h.id);

/** How long a hint holds the toast, in seconds. Longer than an event toast. */
export const HINT_SECONDS = 2.4;

/**
 * Quiet time after a hint before another may fire.
 *
 * Two hints inside a second is not a tutorial, it is noise. Long enough that
 * each one is read; short enough that a course teaching three moves in quick
 * succession still teaches all three.
 */
export const HINT_COOLDOWN = 3.0;
