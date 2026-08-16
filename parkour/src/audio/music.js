/**
 * Procedural music beds.
 *
 * Three beds rather than twelve, with each theme remapping timbre and tempo -
 * the cut the scope notes called for, and the one that costs the least, because
 * what a player remembers from a runner is the pulse, not the melody.
 *
 * Everything is scheduled ahead on the AudioContext clock in short windows. A
 * bed that scheduled note-by-note from requestAnimationFrame would audibly
 * stutter whenever the simulation had a long frame - which is exactly when the
 * player is busy and least forgiving.
 */
import { tone, noise } from './synth.js';

/** How far ahead notes are scheduled, and how often we top that up. */
const LOOKAHEAD = 0.35;
const TICK_MS = 120;

/** Minor-pentatonic degrees, in semitones. Reliable under any harmony. */
const SCALE = [0, 3, 5, 7, 10];

const BEDS = {
  pulse: {
    bpm: 132,
    root: 55,
    lead: 'triangle',
    bass: 'sawtooth',
    // Which sixteenths carry a kick / hat, as a repeating bar pattern.
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    arp: [0, 2, 4, 2, 3, 1, 4, 2],
  },
  drift: {
    bpm: 108,
    root: 49,
    lead: 'sine',
    bass: 'triangle',
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    arp: [0, 4, 3, 2, 0, 3, 4, 1],
  },
  drive: {
    bpm: 148,
    root: 57,
    lead: 'square',
    bass: 'sawtooth',
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    arp: [0, 1, 2, 4, 3, 2, 1, 0],
  },
};

/** Theme → bed. Four themes, three beds; the pairing is the variety. */
const THEME_BED = {
  rooftops: 'pulse',
  undercity: 'drift',
  solarworks: 'drive',
  frostline: 'drift',
};

/** Per-theme detune in semitones, so two themes on one bed still differ. */
const THEME_SHIFT = {
  rooftops: 0,
  undercity: -3,
  solarworks: 2,
  frostline: 5,
};

function midiToFreq(m) {
  return 440 * (2 ** ((m - 69) / 12));
}

/**
 * Builds a bed for a theme.
 *
 * @returns {{start: Function, stop: Function}} or null if audio is unavailable
 */
export function musicBedFor(ctx, out, themeId) {
  if (!ctx || !out) return null;

  const bed = BEDS[THEME_BED[themeId] || 'pulse'];
  const shift = THEME_SHIFT[themeId] ?? 0;
  const sixteenth = 60 / bed.bpm / 4;

  let timer = null;
  let nextTime = 0;
  let step = 0;
  let stopped = false;

  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(out);

  function scheduleStep(at, i) {
    const bar = i % 16;

    if (bed.kick[bar]) {
      tone(ctx, gain, { at, freq: 110, freqTo: 42, type: 'sine', dur: 0.16, gain: 0.5 });
    }
    if (bed.hat[bar]) {
      noise(ctx, gain, { at, freq: 7000, q: 1.6, dur: 0.03, gain: 0.09 });
    }

    // Bass on the downbeat of each half-bar.
    if (bar === 0 || bar === 8) {
      tone(ctx, gain, {
        at, freq: midiToFreq(bed.root + shift), type: bed.bass,
        dur: sixteenth * 6, gain: 0.16,
      });
    }

    // A sparse lead so it never competes with the SFX the player needs to hear.
    if (bar % 2 === 0) {
      const degree = bed.arp[(i / 2 | 0) % bed.arp.length];
      const semitone = SCALE[degree % SCALE.length] + 12 * Math.floor(degree / SCALE.length);
      tone(ctx, gain, {
        at, freq: midiToFreq(bed.root + 24 + shift + semitone),
        type: bed.lead, dur: sixteenth * 1.6, gain: 0.075,
      });
    }
  }

  function pump() {
    if (stopped) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    while (nextTime < horizon) {
      scheduleStep(nextTime, step);
      nextTime += sixteenth;
      step++;
    }
  }

  return {
    start() {
      if (stopped) return;
      nextTime = ctx.currentTime + 0.08;
      step = 0;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 1.4);
      pump();
      timer = setInterval(pump, TICK_MS);
    },
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      } catch { /* context already closed */ }
    },
  };
}

export { BEDS, THEME_BED };
