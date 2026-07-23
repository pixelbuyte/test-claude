import { analyzePulseSamples, RawSample } from '../pulseAnalysis';

/** Builds synthetic camera-brightness samples that mimic a real PPG waveform at a given heart rate. */
function makeSyntheticSamples(opts: {
  bpm: number;
  durationSec: number;
  sampleHz: number;
  jitterMs?: number;
  noiseAmplitude?: number;
}): RawSample[] {
  const { bpm, durationSec, sampleHz, jitterMs = 0, noiseAmplitude = 0 } = opts;
  const freqHz = bpm / 60;
  const samples: RawSample[] = [];
  const intervalMs = 1000 / sampleHz;
  let t = 0;
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  while (t < durationSec * 1000) {
    const jitter = jitterMs > 0 ? (rand() - 0.5) * jitterMs : 0;
    const time = t + jitter;
    const base = 128 + 20 * Math.sin((2 * Math.PI * freqHz * time) / 1000);
    const noise = noiseAmplitude > 0 ? (rand() - 0.5) * noiseAmplitude : 0;
    samples.push({ t: time, value: base + noise });
    t += intervalMs;
  }
  return samples;
}

describe('analyzePulseSamples', () => {
  it('recovers a resting heart rate from a clean synthetic signal', () => {
    const samples = makeSyntheticSamples({ bpm: 68, durationSec: 20, sampleHz: 8 });
    const result = analyzePulseSamples(samples);
    expect(result.bpm).not.toBeNull();
    expect(result.bpm!).toBeGreaterThanOrEqual(64);
    expect(result.bpm!).toBeLessThanOrEqual(72);
    expect(result.signalQuality).not.toBe('poor');
  });

  it('recovers an elevated heart rate with irregular sample timing and noise', () => {
    const samples = makeSyntheticSamples({
      bpm: 96,
      durationSec: 20,
      sampleHz: 7,
      jitterMs: 30,
      noiseAmplitude: 4,
    });
    const result = analyzePulseSamples(samples);
    expect(result.bpm).not.toBeNull();
    expect(result.bpm!).toBeGreaterThanOrEqual(90);
    expect(result.bpm!).toBeLessThanOrEqual(102);
  });

  it('reports HRV as a positive number when the signal is usable', () => {
    const samples = makeSyntheticSamples({ bpm: 72, durationSec: 20, sampleHz: 8 });
    const result = analyzePulseSamples(samples);
    expect(result.hrvRmssdMs).not.toBeNull();
    expect(result.hrvRmssdMs!).toBeGreaterThanOrEqual(0);
  });

  it('returns a poor-quality, null result for too little data', () => {
    const samples = makeSyntheticSamples({ bpm: 70, durationSec: 2, sampleHz: 8 });
    const result = analyzePulseSamples(samples);
    expect(result.bpm).toBeNull();
    expect(result.signalQuality).toBe('poor');
  });

  it('returns a poor-quality result for pure noise (no real pulse)', () => {
    const samples = makeSyntheticSamples({ bpm: 0, durationSec: 20, sampleHz: 8, noiseAmplitude: 30 });
    const result = analyzePulseSamples(samples);
    expect(result.signalQuality).toBe('poor');
  });
});
