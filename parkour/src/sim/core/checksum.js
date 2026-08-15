/**
 * FNV-1a state hashing.
 *
 * Used to prove determinism: two runs of the same race with the same seed must
 * produce identical checksums, and so must a run driven through a jittered
 * frame-delta schedule versus a constant one.
 */

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

export function newChecksum() {
  return FNV_OFFSET >>> 0;
}

export function hashInt(h, value) {
  let x = value | 0;
  let out = h >>> 0;
  for (let i = 0; i < 4; i++) {
    out ^= x & 0xff;
    out = Math.imul(out, FNV_PRIME) >>> 0;
    x >>>= 8;
  }
  return out >>> 0;
}

/**
 * Floats are quantised before hashing. Positions are compared to roughly a
 * tenth of a millimetre, which is far below anything gameplay can perceive but
 * still catches genuine divergence.
 */
export function hashFloat(h, value, quantum = 1e-4) {
  if (!Number.isFinite(value)) return hashInt(h, 0x7fffffff);
  return hashInt(h, Math.round(value / quantum));
}

export function hashVec3(h, v, quantum = 1e-4) {
  let out = hashFloat(h, v.x, quantum);
  out = hashFloat(out, v.y, quantum);
  out = hashFloat(out, v.z, quantum);
  return out;
}

export function hashString(h, str) {
  let out = h >>> 0;
  for (let i = 0; i < str.length; i++) {
    out ^= str.charCodeAt(i) & 0xff;
    out = Math.imul(out, FNV_PRIME) >>> 0;
  }
  return out >>> 0;
}

/**
 * Hashes the gameplay-relevant state of a whole field.
 *
 * Covers what a divergence would actually show up in - position, velocity,
 * speed, state and the scoring counters - rather than every field on the racer,
 * so the checksum stays meaningful when a purely cosmetic field is added.
 */
export function checksumRacers(racers) {
  let h = newChecksum();
  for (let i = 0; i < racers.length; i++) {
    const r = racers[i];
    h = hashInt(h, r.index);
    h = hashVec3(h, r.pos);
    h = hashVec3(h, r.vel);
    h = hashFloat(h, r.speed);
    h = hashInt(h, r.state);
    h = hashInt(h, r.coins);
    h = hashInt(h, r.deaths);
    h = hashInt(h, r.placement);
    h = hashInt(h, r.finished ? 1 : 0);
    h = hashFloat(h, r.finishTime, 1e-3);
  }
  return h >>> 0;
}
