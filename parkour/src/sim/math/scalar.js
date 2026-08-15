/** Scalar helpers. Pure, allocation-free, no dependencies. */

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function invLerp(a, b, v) {
  return a === b ? 0 : (v - a) / (b - a);
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp01(invLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
}

/** Move `current` toward `target` by at most `maxDelta`. */
export function moveToward(current, target, maxDelta) {
  const d = target - current;
  if (d > maxDelta) return current + maxDelta;
  if (d < -maxDelta) return current - maxDelta;
  return target;
}

/**
 * Exponential smoothing for a fixed timestep. `lambda` is the rate constant:
 * larger converges faster. Stable for any step because it uses exp decay.
 */
export function damp(current, target, lambda, step) {
  return lerp(target, current, Math.exp(-lambda * step));
}

/**
 * Critically damped spring step. Returns the new value; writes the new velocity
 * into `out` at index 0 so the caller keeps its own velocity state.
 */
export function springStep(current, velocity, target, omega, step, out) {
  const f = 1 + 2 * step * omega;
  const oo = omega * omega;
  const hoo = step * oo;
  const hhoo = step * hoo;
  const det = 1 / (f + hhoo);
  const detX = (current * f + velocity * step + target * hhoo) * det;
  const detV = (velocity + (target - current) * hoo) * det;
  out[0] = detV;
  return detX;
}

export function sign(v) {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}

export function approxEq(a, b, eps = 1e-6) {
  const d = a - b;
  return (d < 0 ? -d : d) <= eps;
}

/** Wrap `v` into [0, period). */
export function wrap(v, period) {
  const m = v % period;
  return m < 0 ? m + period : m;
}

/** Formats seconds as m:ss.mmm - used by the HUD and results screen. */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--.---';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/** 1st / 2nd / 3rd / 4th ... */
export function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
