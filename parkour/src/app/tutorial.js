/**
 * Deciding which hint to show, and remembering that it was shown.
 *
 * The hints themselves are content (`data/tutorial.js`); this is the small
 * amount of state that turns them into a tutorial: what has already been seen,
 * and how long ago the last one was. Both are the sort of thing that is easy to
 * get subtly wrong - a hint that re-fires every substep, or one that stomps the
 * previous hint before it has been read - so it lives on its own and is tested
 * on its own, with no toast and no DOM anywhere near it.
 *
 * The `seen` map is the save file's own object, mutated in place. The caller
 * persists it; this has no opinion about storage.
 */
import { TUTORIAL_HINTS, TUTORIAL_IDS, HINT_COOLDOWN } from '../data/tutorial.js';

export class TutorialDirector {
  /**
   * @param {object} seen     `save.data.tutorialSeen`, mutated in place
   * @param {object} [opts]   { cooldown }
   */
  constructor(seen = {}, opts = {}) {
    this.seen = seen;
    this.cooldown = opts.cooldown ?? HINT_COOLDOWN;
    this._quiet = 0;
    /** Turned off by the Settings toggle. */
    this.enabled = true;
  }

  /** Hints that have never been shown. */
  get remaining() {
    return TUTORIAL_IDS.filter((id) => this.seen[id] !== true);
  }

  get complete() {
    return this.remaining.length === 0;
  }

  /**
   * Offers the current world state to the hint table.
   *
   * @param {object} a   the player's affordance set
   * @param {object} p   the player racer
   * @param {number} dt  seconds since the last call
   * @returns {object|null} the hint to show, already marked as seen
   */
  update(a, p, dt) {
    if (this._quiet > 0) this._quiet -= dt;
    if (!this.enabled || !a || !p) return null;
    if (this._quiet > 0) return null;

    for (const hint of TUTORIAL_HINTS) {
      if (this.seen[hint.id] === true) continue;
      if (!hint.when(a, p)) continue;
      // Marked before it is shown, not after: the affordance that triggered it
      // stays true for many substeps, and a hint that waits for confirmation
      // would fire on every one of them.
      this.seen[hint.id] = true;
      this._quiet = this.cooldown;
      return hint;
    }
    return null;
  }

  /** Forgets every hint, so the set plays again from the next race. */
  replay() {
    for (const id of TUTORIAL_IDS) delete this.seen[id];
    this._quiet = 0;
    return this.seen;
  }

  /**
   * Points the director at a different `seen` map.
   *
   * Needed because resetting progress replaces the whole save object, and a
   * director still holding the old map would keep writing into something
   * nothing will ever persist.
   */
  rebind(seen) {
    this.seen = seen || {};
    this._quiet = 0;
    return this.seen;
  }
}
