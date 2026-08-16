/**
 * The sound source.
 *
 * There are no audio files in this game. Every sound is built here from
 * oscillators and shaped noise, which is why the whole project is still a folder
 * you can serve statically with nothing to download.
 *
 * Everything is scheduled against the AudioContext clock rather than fired
 * "now". Firing on the main thread means a sound lands wherever the frame
 * happened to land; scheduling means a footstep is exactly where the foot was.
 */

/** One shared noise buffer. Generating it per sound would be the whole budget. */
let noiseBuffer = null;

function getNoise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic noise: a fixed LCG rather than Math.random, so a recording of
  // the game sounds the same twice. (Also keeps the habit consistent with sim.)
  let seed = 22222;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 2147483648) - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * A short tonal blip.
 *
 * @param {AudioContext} ctx
 * @param {AudioNode} out
 * @param {object} o  { at, freq, freqTo, type, dur, gain, attack }
 */
export function tone(ctx, out, o = {}) {
  const at = o.at ?? ctx.currentTime;
  const dur = o.dur ?? 0.12;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.freq ?? 440, at);
  if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), at + dur);

  const peak = o.gain ?? 0.2;
  const attack = o.attack ?? 0.005;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
  return osc;
}

/**
 * Filtered noise - footsteps, impacts, wind.
 *
 * @param {object} o  { at, dur, gain, freq, q, type, freqTo }
 */
export function noise(ctx, out, o = {}) {
  const at = o.at ?? ctx.currentTime;
  const dur = o.dur ?? 0.1;

  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = o.type || 'bandpass';
  filter.frequency.setValueAtTime(o.freq ?? 1200, at);
  if (o.freqTo) filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo), at + dur);
  filter.Q.value = o.q ?? 1;

  const gain = ctx.createGain();
  const peak = o.gain ?? 0.15;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + (o.attack ?? 0.004));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  src.connect(filter).connect(gain).connect(out);
  src.start(at);
  src.stop(at + dur + 0.02);
  return src;
}

/** A two-tone arpeggio - used for pickups and rewards. */
export function arp(ctx, out, o = {}) {
  const at = o.at ?? ctx.currentTime;
  const steps = o.steps || [660, 880];
  const step = o.step ?? 0.055;
  for (let i = 0; i < steps.length; i++) {
    tone(ctx, out, {
      at: at + i * step,
      freq: steps[i],
      type: o.type || 'triangle',
      dur: o.dur ?? 0.11,
      gain: (o.gain ?? 0.16) * (1 - i * 0.12),
    });
  }
}

/**
 * A simple reverb impulse, built rather than loaded.
 *
 * Keeps the parkour SFX from sounding like they were recorded in a vacuum,
 * without shipping an impulse response file.
 */
export function makeReverb(ctx, seconds = 1.1, decay = 3.2) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, length, rate);
  let seed = 8675309;
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = (seed / 2147483648) - 1;
      data[i] = n * (1 - i / length) ** decay;
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}
