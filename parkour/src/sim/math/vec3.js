/**
 * Minimal 3-component vector math.
 *
 * Every operation takes an explicit `out` and returns it, so hot paths never
 * allocate. `create()` exists for setup code only - never call it inside a step.
 */

export function create(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function set(out, x, y, z) {
  out.x = x; out.y = y; out.z = z;
  return out;
}

export function copy(out, a) {
  out.x = a.x; out.y = a.y; out.z = a.z;
  return out;
}

export function zero(out) {
  out.x = 0; out.y = 0; out.z = 0;
  return out;
}

export function add(out, a, b) {
  out.x = a.x + b.x; out.y = a.y + b.y; out.z = a.z + b.z;
  return out;
}

export function sub(out, a, b) {
  out.x = a.x - b.x; out.y = a.y - b.y; out.z = a.z - b.z;
  return out;
}

export function scale(out, a, s) {
  out.x = a.x * s; out.y = a.y * s; out.z = a.z * s;
  return out;
}

/** out = a + b * s - the fused step used by every integrator here. */
export function addScaled(out, a, b, s) {
  out.x = a.x + b.x * s;
  out.y = a.y + b.y * s;
  out.z = a.z + b.z * s;
  return out;
}

export function mul(out, a, b) {
  out.x = a.x * b.x; out.y = a.y * b.y; out.z = a.z * b.z;
  return out;
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(out, a, b) {
  const ax = a.x, ay = a.y, az = a.z;
  const bx = b.x, by = b.y, bz = b.z;
  out.x = ay * bz - az * by;
  out.y = az * bx - ax * bz;
  out.z = ax * by - ay * bx;
  return out;
}

export function lengthSq(a) {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

export function length(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export function distanceSq(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function distance(a, b) {
  return Math.sqrt(distanceSq(a, b));
}

export function normalize(out, a) {
  const len = length(a);
  if (len < 1e-9) {
    out.x = 0; out.y = 0; out.z = 0;
    return out;
  }
  const inv = 1 / len;
  out.x = a.x * inv; out.y = a.y * inv; out.z = a.z * inv;
  return out;
}

export function lerp(out, a, b, t) {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}

export function isFinite3(a) {
  return Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);
}
