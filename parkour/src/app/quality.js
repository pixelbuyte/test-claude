/**
 * Adaptive quality, as a pure decision.
 *
 * The renderer can be told to drop a tier, but deciding *when* is a judgement
 * call with a lot of ways to get it wrong: react to a single slow frame and the
 * game downgrades every time the player alt-tabs back; react too slowly and a
 * struggling device stays at 20 fps for the whole race. So the decision lives
 * here, as arithmetic over frame times with no renderer and no DOM anywhere near
 * it, and `main.js` only carries out the verdict.
 *
 * Four rules, all of them deliberate:
 *
 * - **A 60-frame rolling mean, not an instantaneous reading.** One 40 ms frame
 *   is a garbage collection or a texture upload, not a device that cannot keep
 *   up. A second of frames says something; one frame says nothing.
 * - **Sustained for two seconds.** Even a full second of pressure is often just
 *   the moment a level streams in a new band of geometry. Two seconds of it is
 *   the device telling you the truth.
 * - **Two downgrades per session, maximum.** Below `low` there is nothing left
 *   to give, and a governor that keeps firing while the device is genuinely
 *   overloaded would spend the race rebuilding materials instead of drawing.
 * - **It never raises.** Not a missing feature: raising mid-race guarantees
 *   oscillation, because the frame time that justified the raise was measured at
 *   the cheaper tier. A player who wants their tier back can say so in Settings,
 *   which pins it and stops the governor entirely.
 */
import { QUALITY } from '../config.js';

/** Cheapest first. A downgrade is one step left; there is no step right. */
export const TIER_ORDER = ['low', 'medium', 'high'];

/** The tier one step cheaper than `tier`, or null if there is none. */
export function lowerTier(tier) {
  const i = TIER_ORDER.indexOf(tier);
  return i > 0 ? TIER_ORDER[i - 1] : null;
}

export class QualityGovernor {
  /**
   * @param {string} tier    the tier the renderer was actually built with
   * @param {object} [opts]  { userPinned, windowFrames, thresholdMs,
   *                           sustainSeconds, maxDowngrades, sampleCeilingMs }
   */
  constructor(tier, opts = {}) {
    this.tier = TIER_ORDER.includes(tier) ? tier : 'medium';
    /**
     * Set when the player chose a tier by hand. An explicit choice outranks any
     * measurement: someone who picked `high` on a hot phone knowingly accepted
     * the frame rate, and having the game quietly overrule them is worse than
     * the stutter they asked for.
     */
    this.userPinned = opts.userPinned === true;

    this.windowFrames = opts.windowFrames ?? 60;
    this.thresholdMs = opts.thresholdMs ?? QUALITY.downgradeFrameMs;
    this.sustainSeconds = opts.sustainSeconds ?? QUALITY.downgradeSustainSeconds;
    this.maxDowngrades = opts.maxDowngrades ?? QUALITY.maxAutoDowngrades;
    /**
     * Frames longer than this are clamped rather than discarded. A tab restore
     * or a breakpoint produces a multi-second "frame" that is not evidence of
     * anything; discarding it outright would instead make a genuinely 300 ms
     * device invisible to the governor. Clamping keeps such a frame counted, but
     * stops one of them from dragging a 60-frame mean over the line on its own.
     */
    this.sampleCeilingMs = opts.sampleCeilingMs ?? 250;

    this._ring = new Float64Array(this.windowFrames);
    this._head = 0;
    this._filled = 0;
    this._sum = 0;

    /** Seconds the rolling mean has been continuously over the threshold. */
    this.overSeconds = 0;
    this.downgrades = 0;
  }

  /** Rolling mean frame time in ms, or 0 before any sample has landed. */
  get meanFrameMs() {
    return this._filled === 0 ? 0 : this._sum / this._filled;
  }

  /** True once there is nothing left to downgrade to, or the budget is spent. */
  get exhausted() {
    return this.downgrades >= this.maxDowngrades || lowerTier(this.tier) === null;
  }

  /** Whether `sample` can still return a verdict. */
  get active() {
    return !this.userPinned && !this.exhausted;
  }

  /**
   * Tells the governor the tier changed underneath it.
   *
   * The governor decides one step at a time from whatever is currently on
   * screen, so if anything else moves the tier - a Settings change, a restart -
   * it has to be told, or its next verdict is a step below a tier that is no
   * longer running. Neither the pin nor the downgrade budget is touched: this
   * says *where we are*, not *who is in charge*.
   */
  adopt(tier) {
    if (!TIER_ORDER.includes(tier) || tier === this.tier) return this.tier;
    this.tier = tier;
    // Frame times measured at the old tier are not evidence about the new one.
    this._clearWindow();
    return this.tier;
  }

  /**
   * Records the player's explicit Settings choice.
   *
   * A named tier pins it and stops all automatic adjustment for the session.
   * Passing null means "Auto", which hands control back - and deliberately
   * refunds the downgrade budget, because choosing Auto again is a request for
   * the governor to start over rather than resume mid-ratchet.
   */
  pin(tier) {
    if (tier === null || tier === undefined || tier === '') {
      this.userPinned = false;
      this.downgrades = 0;
    } else {
      if (!TIER_ORDER.includes(tier)) return this.tier;
      this.userPinned = true;
      this.tier = tier;
    }
    this._clearWindow();
    return this.tier;
  }

  /**
   * Feeds one rendered frame in.
   *
   * @param {number} dtSeconds  wall-clock time that frame took
   * @returns {string|null} the tier to switch to, or null to carry on unchanged
   */
  sample(dtSeconds) {
    if (!this.active) return null;
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return null;

    const ms = Math.min(dtSeconds * 1000, this.sampleCeilingMs);

    if (this._filled === this.windowFrames) this._sum -= this._ring[this._head];
    else this._filled++;
    this._ring[this._head] = ms;
    this._head = (this._head + 1) % this.windowFrames;
    this._sum += ms;

    // A partial window has no opinion. Averaging four frames and acting on it is
    // exactly the single-slow-frame failure the rolling mean exists to avoid.
    if (this._filled < this.windowFrames) return null;

    if (this.meanFrameMs <= this.thresholdMs) {
      // One good frame is enough to break the streak. Sustained means sustained.
      this.overSeconds = 0;
      return null;
    }

    // Accumulating the clamped sample rather than the raw delta, so a single
    // stalled frame cannot buy several seconds' worth of "sustained" evidence.
    this.overSeconds += ms / 1000;
    if (this.overSeconds < this.sustainSeconds) return null;

    const next = lowerTier(this.tier);
    if (next === null) return null;

    this.tier = next;
    this.downgrades++;
    // Fresh evidence for the next verdict: the window still holds frame times
    // measured at the tier we just left, which say nothing about the new one.
    this._clearWindow();
    return next;
  }

  _clearWindow() {
    this._ring.fill(0);
    this._head = 0;
    this._filled = 0;
    this._sum = 0;
    this.overSeconds = 0;
  }
}
