import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as v3 from '../src/sim/math/vec3.js';
import {
  clamp, clamp01, lerp, invLerp, smoothstep, moveToward, damp, springStep,
  sign, approxEq, formatTime, ordinal,
} from '../src/sim/math/scalar.js';
import { Rng, hashString, mix32 } from '../src/sim/math/prng.js';
import { Pool } from '../src/sim/core/pool.js';
import { EventQueue, EV } from '../src/sim/core/events.js';
import { createStepper, advance } from '../src/sim/core/fixedloop.js';
import { STEP } from '../src/config.js';

test('vec3 ops write into out and return that same object', () => {
  const out = v3.create();
  const a = v3.create(1, 2, 3);
  const b = v3.create(4, 5, 6);

  // Identity of `out` is the zero-allocation contract every hot path relies on.
  assert.equal(v3.add(out, a, b), out);
  assert.deepEqual({ x: out.x, y: out.y, z: out.z }, { x: 5, y: 7, z: 9 });

  assert.equal(v3.sub(out, b, a), out);
  assert.deepEqual({ x: out.x, y: out.y, z: out.z }, { x: 3, y: 3, z: 3 });

  v3.addScaled(out, a, b, 2);
  assert.deepEqual({ x: out.x, y: out.y, z: out.z }, { x: 9, y: 12, z: 15 });

  assert.equal(v3.dot(a, b), 32);
});

test('vec3 length, distance and normalize', () => {
  const a = v3.create(3, 4, 0);
  assert.equal(v3.length(a), 5);
  assert.equal(v3.lengthSq(a), 25);

  const out = v3.create();
  v3.normalize(out, a);
  assert.ok(approxEq(v3.length(out), 1));

  // A zero vector normalizes to zero rather than NaN.
  v3.normalize(out, v3.create(0, 0, 0));
  assert.deepEqual({ x: out.x, y: out.y, z: out.z }, { x: 0, y: 0, z: 0 });

  assert.equal(v3.distance(v3.create(0, 0, 0), v3.create(0, 0, 7)), 7);
});

test('scalar helpers', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-5, 0, 3), 0);
  assert.equal(clamp01(0.5), 0.5);
  assert.equal(lerp(0, 10, 0.25), 2.5);
  assert.equal(invLerp(10, 20, 15), 0.5);
  assert.equal(smoothstep(0, 1, 0), 0);
  assert.equal(smoothstep(0, 1, 1), 1);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
  assert.equal(moveToward(0, 10, 3), 3);
  assert.equal(moveToward(0, 1, 3), 1, 'never overshoots the target');
  assert.equal(moveToward(10, 0, 3), 7);
  assert.equal(sign(-2), -1);
  assert.equal(sign(0), 0);
});

test('damp converges toward the target and never overshoots', () => {
  let x = 0;
  for (let i = 0; i < 200; i++) x = damp(x, 10, 8, STEP);
  assert.ok(x > 9.9 && x <= 10, `expected to approach 10, got ${x}`);
});

test('critically damped spring settles without overshoot', () => {
  let x = 0;
  const vel = [0];
  let maxSeen = 0;
  for (let i = 0; i < 240; i++) {
    x = springStep(x, vel[0], 5, 18, STEP, vel);
    if (x > maxSeen) maxSeen = x;
  }
  assert.ok(Math.abs(x - 5) < 0.01, `expected to settle at 5, got ${x}`);
  assert.ok(maxSeen <= 5.001, `critically damped must not overshoot, peaked at ${maxSeen}`);
});

test('formatTime and ordinal', () => {
  assert.equal(formatTime(0), '0:00.000');
  assert.equal(formatTime(65.5), '1:05.500');
  assert.equal(formatTime(-1), '--:--.---');
  assert.equal(ordinal(1), '1st');
  assert.equal(ordinal(2), '2nd');
  assert.equal(ordinal(3), '3rd');
  assert.equal(ordinal(4), '4th');
  assert.equal(ordinal(11), '11th');
  assert.equal(ordinal(21), '21st');
});

test('the same seed reproduces the same sequence', () => {
  const a = new Rng(1234, 'layout');
  const b = new Rng(1234, 'layout');
  for (let i = 0; i < 64; i++) assert.equal(a.float(), b.float());
});

test('named streams are independent of one another', () => {
  // Adding an AI opponent must not shift the level layout drawn from the same seed.
  const layout = new Rng(99, 'layout');
  const first = [];
  for (let i = 0; i < 8; i++) first.push(layout.float());

  const layout2 = new Rng(99, 'layout');
  const ai = new Rng(99, 'ai:vex');
  const second = [];
  for (let i = 0; i < 8; i++) {
    ai.float();
    second.push(layout2.float());
  }
  assert.deepEqual(second, first);
});

test('rng stays inside its documented ranges', () => {
  const rng = new Rng(7, 'test');
  for (let i = 0; i < 2000; i++) {
    const f = rng.float();
    assert.ok(f >= 0 && f < 1);
    const r = rng.range(-3, 5);
    assert.ok(r >= -3 && r < 5);
    const n = rng.int(2, 6);
    assert.ok(n >= 2 && n <= 6 && Number.isInteger(n));
  }
});

test('weighted picks respect zero weights', () => {
  const rng = new Rng(5, 'w');
  const weights = [0, 3, 0, 1];
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(rng.pickWeightedIndex(weights));
  assert.ok(!seen.has(0) && !seen.has(2), 'zero-weight entries must never be picked');
  assert.ok(seen.has(1) && seen.has(3));
  assert.equal(rng.pickWeightedIndex([0, 0, 0]), -1);
});

test('hashString and mix32 are stable and well distributed', () => {
  assert.equal(hashString('layout'), hashString('layout'));
  assert.notEqual(hashString('layout'), hashString('layouu'));
  assert.notEqual(mix32(1), mix32(2));
  assert.ok(mix32(0) >= 0 && mix32(0) <= 0xffffffff);
});

test('pool recycles instances and refuses to grow', () => {
  let built = 0;
  const pool = new Pool(3, () => ({ id: built++, live: false }), (o) => { o.live = false; });
  const a = pool.acquire();
  const b = pool.acquire();
  const c = pool.acquire();
  assert.equal(pool.inUse, 3);
  assert.equal(pool.acquire(), null, 'an exhausted pool returns null rather than allocating');
  assert.equal(pool.exhaustedCount, 1);
  assert.equal(built, 3, 'construction happens once, up front');

  pool.releaseAll();
  assert.equal(pool.inUse, 0);
  const again = pool.acquire();
  assert.ok([a, b, c].includes(again), 'the same instances come back around');
});

test('event queue drains oldest first and empties', () => {
  const q = new EventQueue(8);
  q.push(EV.JUMP, 0, 1);
  q.push(EV.LAND, 0, 2);
  q.push(EV.COIN, 1, 3);
  assert.equal(q.count, 3);
  assert.equal(q.countOf(EV.COIN), 1);

  const seen = [];
  q.drain((e) => seen.push([e.type, e.actor, e.a]));
  assert.deepEqual(seen, [[EV.JUMP, 0, 1], [EV.LAND, 0, 2], [EV.COIN, 1, 3]]);
  assert.equal(q.count, 0);
  assert.equal(q.dropped, 0);
});

test('event queue overwrites the oldest instead of growing', () => {
  const q = new EventQueue(4);
  for (let i = 0; i < 6; i++) q.push(EV.FOOTSTEP, 0, i);
  assert.equal(q.count, 4);
  assert.equal(q.dropped, 2);
  const seen = [];
  q.drain((e) => seen.push(e.a));
  assert.deepEqual(seen, [2, 3, 4, 5], 'the newest events survive');
});

test('fixed loop yields whole steps and an interpolation alpha', () => {
  const s = createStepper();
  assert.equal(advance(s, STEP), 1);
  assert.ok(Math.abs(s.alpha) < 1e-6);

  assert.equal(advance(s, STEP * 0.5), 0, 'a partial step runs nothing yet');
  assert.ok(s.alpha > 0.49 && s.alpha < 0.51);
  assert.equal(advance(s, STEP * 0.5), 1, 'the remainder completes the step');
});

test('a long stall is capped and does not compound', () => {
  // Returning from a backgrounded tab hands us a huge delta. The clamp must
  // absorb it in one frame rather than spreading a backlog across the next ten.
  const s = createStepper();
  const steps = advance(s, 5.0);
  assert.ok(steps <= s.maxSubsteps, `expected at most ${s.maxSubsteps} substeps, got ${steps}`);
  const next = advance(s, STEP);
  assert.ok(next <= 2, `a stall must not compound, got ${next} steps next frame`);
});

test('the substep cap discards the backlog it cannot run', () => {
  // Frame-delta clamping alone happens to bound the default config at exactly
  // maxSubsteps, so exercise the cap directly with a tighter budget.
  const s = createStepper(STEP, 2);
  const steps = advance(s, 0.1);
  assert.equal(steps, 2, 'never runs more substeps than the budget allows');
  assert.ok(s.droppedSteps > 0, 'the excess is dropped, not carried forward');
  assert.ok(s.accumulator < STEP, 'the accumulator is left with less than one whole step');
});
