/**
 * Sound, driven entirely by the event queue.
 *
 * The simulation never calls this. It pushes events; this drains them and
 * decides what they sound like. That is the same seam the renderer uses, and it
 * is why a headless race is silent rather than broken.
 *
 * Browsers refuse to start audio without a gesture, so the context is created
 * lazily on the first real interaction and everything before that is a no-op.
 */
import { EV } from '../sim/core/events.js';
import { SURFACE } from '../config.js';
import { tone, noise, arp, makeReverb } from './synth.js';
import { musicBedFor } from './music.js';

/** Per-surface footstep character. Indexed by SURFACE. */
const FOOTSTEP = [
  { freq: 900, q: 1.2, gain: 0.055, dur: 0.055 },   // concrete
  { freq: 2400, q: 2.6, gain: 0.05, dur: 0.05 },    // metal
  { freq: 620, q: 1.0, gain: 0.05, dur: 0.06 },     // wood
  { freq: 3200, q: 3.5, gain: 0.04, dur: 0.045 },   // glass
  { freq: 1800, q: 2.0, gain: 0.05, dur: 0.05 },    // grate
];

export class AudioManager {
  constructor(opts = {}) {
    this.enabled = opts.enabled !== false;
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.reverb = null;
    this.music = null;
    this.started = false;
    this.failed = false;

    /** Footsteps are paced from speed rather than from an animation callback. */
    this._stepTimer = 0;
  }

  /**
   * Creates the context. Must be called from inside a user gesture handler, or
   * the browser will hand back a suspended context that never plays anything.
   */
  start() {
    if (this.started || this.failed || !this.enabled) return false;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { this.failed = true; return false; }
      this.ctx = new Ctx();

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);

      // A little space on the SFX only - music beds carry their own.
      this.reverb = makeReverb(this.ctx, 0.9, 3.4);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.16;
      this.sfxBus.connect(this.reverb).connect(wet).connect(this.master);

      this.started = true;
      return true;
    } catch {
      // Audio is a nicety. Losing it must never take the game with it.
      this.failed = true;
      return false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.master) return;
    this.master.gain.value = on ? 0.9 : 0;
  }

  /** Starts (or swaps) the procedural music bed for a theme. */
  playMusic(themeId) {
    if (!this.started) return;
    if (this.music) this.music.stop();
    this.music = musicBedFor(this.ctx, this.musicBus, themeId);
    if (this.music) this.music.start();
  }

  stopMusic() {
    if (this.music) {
      this.music.stop();
      this.music = null;
    }
  }

  /**
   * Footsteps.
   *
   * Paced from actual speed rather than an animation event, so the cadence is
   * right at any pace and never drifts out of sync with the legs.
   */
  updateFootsteps(dt, p) {
    if (!this.started || !this.enabled) return;
    if (!p.grounded || p.speed < 1.5) { this._stepTimer = 0; return; }

    const stride = Math.max(0.16, 0.62 - p.speed * 0.019);
    this._stepTimer -= dt;
    if (this._stepTimer > 0) return;
    this._stepTimer = stride;

    const s = FOOTSTEP[p.groundSurface] || FOOTSTEP[0];
    noise(this.ctx, this.sfxBus, {
      freq: s.freq, q: s.q, dur: s.dur,
      gain: s.gain * Math.min(1, 0.5 + p.speed / 20),
    });
  }

  /**
   * Turns one simulation event into a sound.
   *
   * Only the player's events make noise: a five-racer field all footstepping
   * would be mud, and the opponents are visible anyway.
   */
  handle(e, playerIndex) {
    if (!this.started || !this.enabled) return;
    if (e.actor !== playerIndex && e.type !== EV.COUNTDOWN_TICK && e.type !== EV.RACE_START) return;

    const ctx = this.ctx;
    const bus = this.sfxBus;

    switch (e.type) {
      case EV.JUMP:
        tone(ctx, bus, { freq: 320, freqTo: 560, type: 'triangle', dur: 0.14, gain: 0.13 });
        noise(ctx, bus, { freq: 800, freqTo: 2000, dur: 0.09, gain: 0.05 });
        break;

      case EV.DOUBLE_JUMP:
        tone(ctx, bus, { freq: 480, freqTo: 820, type: 'triangle', dur: 0.16, gain: 0.14 });
        break;

      case EV.LAND: {
        // Louder the harder the landing - `a` carries the impact speed.
        const impact = Math.min(1, (e.a || 0) / 26);
        noise(ctx, bus, { freq: 260, freqTo: 90, q: 0.8, dur: 0.14, gain: 0.06 + impact * 0.12 });
        break;
      }

      case EV.SLIDE_START:
        noise(ctx, bus, { freq: 2600, freqTo: 700, q: 1.4, dur: 0.42, gain: 0.09 });
        break;

      case EV.VAULT:
        noise(ctx, bus, { freq: 1400, freqTo: 500, dur: 0.14, gain: 0.08 });
        tone(ctx, bus, { freq: 220, freqTo: 380, type: 'sawtooth', dur: 0.12, gain: 0.06 });
        break;

      case EV.WALLRUN_START:
        noise(ctx, bus, { freq: 700, freqTo: 1800, q: 2.2, dur: 0.3, gain: 0.07 });
        break;

      case EV.WALL_JUMP:
        tone(ctx, bus, { freq: 300, freqTo: 700, type: 'square', dur: 0.13, gain: 0.1 });
        noise(ctx, bus, { freq: 1600, freqTo: 600, dur: 0.12, gain: 0.07 });
        break;

      case EV.MANTLE:
        noise(ctx, bus, { freq: 900, freqTo: 400, dur: 0.2, gain: 0.07 });
        break;

      case EV.LAUNCH_PAD:
        tone(ctx, bus, { freq: 180, freqTo: 900, type: 'sawtooth', dur: 0.3, gain: 0.16 });
        break;

      case EV.COIN:
        // Slightly detuned per coin so a run of them arpeggiates instead of
        // hammering the same pitch.
        arp(ctx, bus, { steps: [880 + (e.a % 5) * 40, 1320], dur: 0.07, gain: 0.09, step: 0.04 });
        break;

      case EV.SHARD:
        arp(ctx, bus, { steps: [740, 1108, 1480], dur: 0.12, gain: 0.12, step: 0.06 });
        break;

      case EV.POWERUP_PICKUP:
        arp(ctx, bus, { steps: [520, 780, 1040, 1560], type: 'square', dur: 0.1, gain: 0.1, step: 0.05 });
        break;

      case EV.POWERUP_EXPIRE:
        tone(ctx, bus, { freq: 620, freqTo: 300, type: 'triangle', dur: 0.2, gain: 0.07 });
        break;

      case EV.SHIELD_ABSORB:
        tone(ctx, bus, { freq: 900, freqTo: 300, type: 'square', dur: 0.24, gain: 0.14 });
        noise(ctx, bus, { freq: 3000, freqTo: 800, dur: 0.2, gain: 0.08 });
        break;

      case EV.CRASH:
        noise(ctx, bus, { freq: 400, freqTo: 120, q: 0.7, dur: 0.3, gain: 0.2 });
        tone(ctx, bus, { freq: 150, freqTo: 60, type: 'sawtooth', dur: 0.26, gain: 0.12 });
        break;

      case EV.DEATH:
        tone(ctx, bus, { freq: 400, freqTo: 70, type: 'sawtooth', dur: 0.7, gain: 0.18 });
        noise(ctx, bus, { freq: 900, freqTo: 100, dur: 0.6, gain: 0.12 });
        break;

      case EV.RESPAWN:
        arp(ctx, bus, { steps: [300, 450, 600], dur: 0.14, gain: 0.1, step: 0.07 });
        break;

      case EV.BOOST_PAD:
        tone(ctx, bus, { freq: 260, freqTo: 1200, type: 'sawtooth', dur: 0.26, gain: 0.13 });
        break;

      case EV.CHECKPOINT:
        arp(ctx, bus, { steps: [660, 990], dur: 0.16, gain: 0.12, step: 0.09 });
        break;

      case EV.COUNTDOWN_TICK:
        // "GO" is the one that gets the higher, longer note.
        if (e.a > 0) tone(ctx, bus, { freq: 440, type: 'square', dur: 0.12, gain: 0.16 });
        else tone(ctx, bus, { freq: 880, type: 'square', dur: 0.3, gain: 0.2 });
        break;

      case EV.FINISH:
        arp(ctx, bus, { steps: [660, 880, 1100, 1320], dur: 0.24, gain: 0.16, step: 0.1 });
        break;

      case EV.RANK_CHANGE:
        tone(ctx, bus, { freq: 700, freqTo: 950, type: 'triangle', dur: 0.1, gain: 0.07 });
        break;

      default:
        break;
    }
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
    this.started = false;
  }
}

export { SURFACE };
