export interface RawSample {
  /** Milliseconds since the start of the capture. */
  t: number;
  /** Average red-channel brightness for this frame (0-255). */
  value: number;
}

export interface PulseAnalysisResult {
  bpm: number | null;
  hrvRmssdMs: number | null;
  signalQuality: 'good' | 'fair' | 'poor';
  beatCount: number;
}

const RESAMPLE_HZ = 10;
const MIN_BPM = 40;
const MAX_BPM = 180;
const MIN_DURATION_SEC = 8;

const POOR: PulseAnalysisResult = {
  bpm: null,
  hrvRmssdMs: null,
  signalQuality: 'poor',
  beatCount: 0,
};

function resampleUniform(samples: RawSample[], hz: number): Float64Array {
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  const n = Math.max(1, Math.floor(((t1 - t0) / 1000) * hz));
  const out = new Float64Array(n);
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const targetT = t0 + (i * 1000) / hz;
    while (cursor < samples.length - 2 && samples[cursor + 1].t < targetT) cursor++;
    const a = samples[cursor];
    const b = samples[Math.min(cursor + 1, samples.length - 1)];
    const span = b.t - a.t;
    const frac = span > 0 ? (targetT - a.t) / span : 0;
    out[i] = a.value + (b.value - a.value) * frac;
  }
  return out;
}

function movingAverage(data: Float64Array, windowSize: number): Float64Array {
  const out = new Float64Array(data.length);
  const half = Math.floor(windowSize / 2);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i > windowSize - 1) sum -= data[i - windowSize];
    const count = Math.min(i + 1, windowSize);
    out[Math.max(0, i - half)] = sum / count;
  }
  return out;
}

function detrend(data: Float64Array, hz: number): Float64Array {
  const baseline = movingAverage(data, hz); // ~1 second window removes DC drift
  const out = new Float64Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] - baseline[i];
  return out;
}

function findPeaks(data: Float64Array, minDistance: number): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] >= data[i + 1] && data[i] > 0) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      } else if (data[i] > data[peaks[peaks.length - 1]]) {
        peaks[peaks.length - 1] = i; // keep the taller of two close peaks
      }
    }
  }
  return peaks;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/**
 * Normalized autocorrelation at a given lag: how well the signal repeats
 * itself one estimated heartbeat later. Real periodic pulses score close to
 * 1; random noise scores close to 0. This is what actually distinguishes "a
 * real pulse" from "some peaks that happened to line up" — interval and
 * amplitude consistency alone let noise sneak through too often.
 */
function periodicityStrength(x: Float64Array, lagSamples: number): number {
  if (lagSamples <= 0 || lagSamples >= x.length) return 0;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i + lagSamples < x.length; i++) {
    num += x[i] * x[i + lagSamples];
    denA += x[i] * x[i];
    denB += x[i + lagSamples] * x[i + lagSamples];
  }
  const denom = Math.sqrt(denA * denB);
  return denom > 0 ? num / denom : 0;
}

/**
 * Turns raw camera-brightness samples into a heart-rate + HRV estimate.
 *
 * This runs on real signal processing (resample -> detrend -> smooth -> peak
 * detect -> interbeat intervals), not a placeholder. The honesty boundary is
 * the *label* on the result, not the math: it is always a wellness estimate,
 * never a diagnosis, and `signalQuality` tells the UI when to say so plainly
 * instead of showing a confident-looking wrong number.
 */
export function analyzePulseSamples(samples: RawSample[]): PulseAnalysisResult {
  if (samples.length < RESAMPLE_HZ * MIN_DURATION_SEC * 0.4) return POOR;

  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const durationSec = (sorted[sorted.length - 1].t - sorted[0].t) / 1000;
  if (durationSec < MIN_DURATION_SEC) return POOR;

  const uniform = resampleUniform(sorted, RESAMPLE_HZ);
  const detrended = detrend(uniform, RESAMPLE_HZ);
  const smoothed = movingAverage(detrended, 3);

  // The 1-second detrend window is least accurate right at the edges of the
  // capture, so trim a second off each end before looking for beats.
  const edgeTrim = RESAMPLE_HZ;
  if (smoothed.length <= edgeTrim * 2 + RESAMPLE_HZ * MIN_DURATION_SEC * 0.5) return POOR;
  const analysisWindow = smoothed.subarray(edgeTrim, smoothed.length - edgeTrim);

  const minDistSamples = Math.round((60 / MAX_BPM) * RESAMPLE_HZ);
  const peaks = findPeaks(analysisWindow, minDistSamples);
  if (peaks.length < 4) return POOR;

  const ibisMs: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    ibisMs.push(((peaks[i] - peaks[i - 1]) * 1000) / RESAMPLE_HZ);
  }
  const minIbi = 60000 / MAX_BPM;
  const maxIbi = 60000 / MIN_BPM;
  const validIbis = ibisMs.filter((ibi) => ibi >= minIbi && ibi <= maxIbi);
  if (validIbis.length < 3) return POOR;

  const instBpms = validIbis.map((ibi) => 60000 / ibi);
  const bpm = Math.round(median(instBpms));

  const diffs: number[] = [];
  for (let i = 1; i < validIbis.length; i++) diffs.push(validIbis[i] - validIbis[i - 1]);
  const hrvRmssdMs = diffs.length > 0 ? Math.sqrt(mean(diffs.map((d) => d * d))) : null;

  const ibiCv = stdev(validIbis) / mean(validIbis);
  const periodSamples = Math.round((RESAMPLE_HZ * 60) / bpm);
  const periodicity = periodicityStrength(analysisWindow, periodSamples);

  // Interval regularity alone lets filtered noise sneak through (a random
  // walk can produce evenly-spaced peaks by chance). Periodicity strength
  // checks that the whole waveform actually repeats, which noise doesn't —
  // that combination is what keeps this from becoming another app that shows
  // a confident-looking number it can't back up.
  let signalQuality: PulseAnalysisResult['signalQuality'];
  if (ibiCv < 0.15 && periodicity > 0.5) {
    signalQuality = 'good';
  } else if (ibiCv < 0.3 && periodicity > 0.3) {
    signalQuality = 'fair';
  } else {
    signalQuality = 'poor';
  }

  return { bpm, hrvRmssdMs, signalQuality, beatCount: validIbis.length + 1 };
}
