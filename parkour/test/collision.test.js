import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ColliderSet, makeAABB, setBodyAABB, setBoxAABB } from '../src/sim/world/colliderSet.js';
import { Broadphase } from '../src/sim/world/broadphase.js';
import {
  sweepAxis, makeSweepResult, safeDelta, overlapBox,
  groundProbe, makeGroundResult, gapAhead,
} from '../src/sim/world/sweep.js';
import { KIND, FLAG, LEVEL, kindMask, STEP, MOVEMENT } from '../src/config.js';

function buildWorld(boxes) {
  const cs = new ColliderSet(Math.max(boxes.length, 1));
  for (const b of boxes) {
    cs.add(b[0], b[1], b[2], b[3], b[4], b[5],
      b[6] ?? KIND.SOLID, b[7] ?? 0, b[8] ?? 0);
  }
  const bp = new Broadphase(LEVEL.bucketSize).build(cs);
  return { cs, bp, scratch: new Int32Array(LEVEL.queryCapacity) };
}

test('broadphase returns exactly the colliders overlapping the query range', () => {
  const { cs, bp, scratch } = buildWorld([
    [-1, 0, 0, 1, 1, 5],     // 0: z 0..5
    [-1, 0, 10, 1, 1, 15],   // 1: z 10..15
    [-1, 0, 30, 1, 1, 35],   // 2: z 30..35
  ]);

  let n = bp.query(1, 3, scratch);
  assert.deepEqual(Array.from(scratch.slice(0, n)), [0]);

  n = bp.query(11, 12, scratch);
  assert.deepEqual(Array.from(scratch.slice(0, n)), [1]);

  n = bp.query(4, 11, scratch);
  assert.deepEqual(Array.from(scratch.slice(0, n)).sort(), [0, 1]);

  n = bp.query(100, 110, scratch);
  assert.equal(n, 0, 'a query past the end of the level returns nothing');
  assert.equal(bp.overflowCount, 0);
  assert.equal(cs.count, 3);
});

test('a collider spanning many buckets is reported exactly once', () => {
  // 60 m long at a 4 m bucket size means this box lives in 15 buckets.
  const { bp, scratch } = buildWorld([[-2, 0, 0, 2, 1, 60]]);
  const n = bp.query(5, 55, scratch);
  assert.equal(n, 1, 'the visit stamp dedupes multi-bucket colliders');
  assert.equal(scratch[0], 0);
});

test('the broadphase result buffer keeps its identity across queries', () => {
  const { bp, scratch } = buildWorld([[-1, 0, 0, 1, 1, 5]]);
  const before = scratch;
  bp.query(0, 5, scratch);
  bp.query(0, 5, scratch);
  assert.equal(scratch, before, 'queries write into the caller buffer, never a fresh one');
});

test('broadphase filters by collider kind', () => {
  const { bp, scratch } = buildWorld([
    [-1, 0, 0, 1, 1, 5, KIND.SOLID],
    [-1, 0, 0, 1, 1, 5, KIND.TRIGGER],
  ]);
  const n = bp.query(1, 2, scratch, kindMask(KIND.TRIGGER));
  assert.equal(n, 1);
  assert.equal(scratch[0], 1);
});

test('broadphase reports overflow rather than writing past the buffer', () => {
  const boxes = [];
  for (let i = 0; i < 40; i++) boxes.push([-1, i, 0, 1, i + 0.5, 5]);
  const { bp } = buildWorld(boxes);
  const tiny = new Int32Array(8);
  const n = bp.query(1, 2, tiny);
  assert.equal(n, 8);
  assert.equal(bp.overflowCount, 1, 'overflow is counted, not silently truncated');
});

test('sweep finds the exact time of impact', () => {
  const { cs, bp, scratch } = buildWorld([[-5, 0, 10, 5, 5, 11]]);
  const n = bp.query(0, 20, scratch);
  const body = setBodyAABB(makeAABB(), 0, 0, 0, 0.275, 1.75, 0.275);
  const result = makeSweepResult();

  // Front face of the body is at z = 0.275; the wall starts at z = 10.
  sweepAxis(body, 2, 20, cs, scratch, n, 0, result);
  assert.equal(result.index, 0);
  assert.ok(Math.abs(result.toi - (10 - 0.275) / 20) < 1e-6);
});

test('sweep misses when the other axes do not overlap', () => {
  const { cs, bp, scratch } = buildWorld([[20, 0, 10, 25, 5, 11]]);
  const n = bp.query(0, 20, scratch);
  const body = setBodyAABB(makeAABB(), 0, 0, 0, 0.275, 1.75, 0.275);
  const result = makeSweepResult();
  sweepAxis(body, 2, 20, cs, scratch, n, 0, result);
  assert.equal(result.index, -1, 'a wall off to the side is not in the way');
  assert.equal(result.toi, 1);
});

test('a tangent pass grazes without registering a hit', () => {
  // Wall occupies x >= 0.275, body's right face sits exactly at 0.275.
  const { cs, bp, scratch } = buildWorld([[0.275, 0, 10, 5, 5, 11]]);
  const n = bp.query(0, 20, scratch);
  const body = setBodyAABB(makeAABB(), 0, 0, 0, 0.275, 1.75, 0.275);
  const result = makeSweepResult();
  sweepAxis(body, 2, 20, cs, scratch, n, 0, result);
  assert.equal(result.index, -1, 'touching faces are not overlapping faces');
});

test('sweep reports zero time of impact when already penetrating', () => {
  const { cs, bp, scratch } = buildWorld([[-5, 0, -1, 5, 5, 1]]);
  const n = bp.query(-5, 5, scratch);
  const body = setBodyAABB(makeAABB(), 0, 0, 0, 0.275, 1.75, 0.275);
  const result = makeSweepResult();
  sweepAxis(body, 2, 5, cs, scratch, n, 0, result);
  assert.equal(result.toi, 0);
  assert.ok(result.penetrating);
});

test('nothing tunnels, even at absurd speed', () => {
  // 200 m/s is nine times the game's top speed, so the body covers 3.3 m in one
  // substep. The wall is 20 cm thick and sits squarely inside that span - a
  // teleport-and-test integrator would sail straight through it.
  const delta = 200 * STEP;
  const wallZ = 2;
  const { cs, bp, scratch } = buildWorld([[-5, 0, wallZ, 5, 5, wallZ + 0.2]]);
  const body = setBodyAABB(makeAABB(), 0, 0, 0, 0.275, 1.75, 0.275);
  const result = makeSweepResult();

  assert.ok(0.275 + delta > wallZ + 0.2, 'the test must actually straddle the wall');

  const n = bp.query(-1, 1 + delta, scratch);
  sweepAxis(body, 2, delta, cs, scratch, n, 0, result);
  assert.equal(result.index, 0, 'a swept test cannot skip past a thin wall');
  assert.ok(Math.abs(result.toi - (wallZ - 0.275) / delta) < 1e-6);

  const safe = safeDelta(delta, result);
  assert.ok(0.275 + safe < wallZ, `body must stop short of the wall, ended at ${0.275 + safe}`);
});

test('safeDelta passes the full move through when nothing is hit', () => {
  const result = makeSweepResult();
  assert.equal(safeDelta(3, result), 3);
});

test('one-way platforms stop a fall but not a rise', () => {
  const { cs, bp, scratch } = buildWorld([
    [-5, 5, 0, 5, 5.2, 20, KIND.PLATFORM, FLAG.ONE_WAY],
  ]);
  const n = bp.query(-1, 21, scratch);
  const result = makeSweepResult();

  // Falling from above: blocked.
  const falling = setBodyAABB(makeAABB(), 0, 6, 10, 0.275, 1.75, 0.275);
  sweepAxis(falling, 1, -2, cs, scratch, n, 0, result);
  assert.equal(result.index, 0, 'landing on a one-way platform is a collision');

  // Rising from below: passes through.
  const rising = setBodyAABB(makeAABB(), 0, 1, 10, 0.275, 1.75, 0.275);
  sweepAxis(rising, 1, 5, cs, scratch, n, 0, result);
  assert.equal(result.index, -1, 'jumping up through a one-way platform is allowed');
});

test('triggers and rails are never solid', () => {
  const { cs, bp, scratch } = buildWorld([
    [-5, 0, 10, 5, 5, 11, KIND.TRIGGER],
    [-5, 0, 12, 5, 5, 13, KIND.RAIL],
  ]);
  const n = bp.query(0, 20, scratch);
  const body = setBodyAABB(makeAABB(), 0, 0, 0, 0.275, 1.75, 0.275);
  const result = makeSweepResult();
  sweepAxis(body, 2, 20, cs, scratch, n, 0, result);
  assert.equal(result.index, -1);
});

test('overlapBox collects every collider inside the probe volume', () => {
  const { cs, bp, scratch } = buildWorld([
    [-1, 0, 0, 1, 1, 2],
    [-1, 0, 1.5, 1, 3, 4],
    [-1, 0, 20, 1, 1, 22],
  ]);
  const n = bp.query(0, 5, scratch);
  // The probe sits above the short box and inside the tall one - exactly the
  // shape of a "is there a wall beside me at chest height" affordance query.
  const probe = setBoxAABB(makeAABB(), -0.5, 1.2, 1.6, 0.5, 2.5, 3);
  const out = new Int32Array(16);
  const m = overlapBox(probe, cs, scratch, n, 0, out);
  assert.equal(m, 1, 'the short box is below the probe and the far box is out of range');
  assert.equal(out[0], 1);

  // Drop the probe to floor level and it should now catch both near boxes.
  const low = setBoxAABB(makeAABB(), -0.5, 0.2, 1.6, 0.5, 2.5, 3);
  const m2 = overlapBox(low, cs, scratch, n, 0, out);
  assert.equal(m2, 2);
});

test('ground probe reports the highest surface under the feet', () => {
  const { cs, bp, scratch } = buildWorld([
    [-5, 0, 0, 5, 1, 20],       // floor at y = 1
    [-5, 0, 5, 5, 2.5, 8],      // crate top at y = 2.5
  ]);
  const n = bp.query(0, 20, scratch);
  const g = makeGroundResult();

  groundProbe(0, 2.6, 6, 0.275, 0.275, 1.0, cs, scratch, n, g);
  assert.ok(g.hit);
  assert.equal(g.y, 2.5, 'standing on the crate, not the floor beneath it');

  groundProbe(0, 1.1, 15, 0.275, 0.275, 1.0, cs, scratch, n, g);
  assert.ok(g.hit);
  assert.equal(g.y, 1);

  groundProbe(0, 12, 15, 0.275, 0.275, 1.0, cs, scratch, n, g);
  assert.ok(!g.hit, 'nothing is within probe range high in the air');
});

test('ramps report their analytic height, not their box top', () => {
  // Rises from y=0 at z=0 to y=4 at z=8.
  const { cs, bp, scratch } = buildWorld([
    [-3, 0, 0, 3, 4, 8, KIND.RAMP],
  ]);
  const n = bp.query(-1, 9, scratch);

  assert.ok(Math.abs(cs.rampY(0, 0) - 0) < 1e-6);
  assert.ok(Math.abs(cs.rampY(0, 4) - 2) < 1e-6, 'halfway up the ramp is half its height');
  assert.ok(Math.abs(cs.rampY(0, 8) - 4) < 1e-6);

  const g = makeGroundResult();
  groundProbe(0, 2.05, 4, 0.275, 0.275, 0.5, cs, scratch, n, g);
  assert.ok(g.hit);
  assert.ok(Math.abs(g.y - 2) < 1e-6, 'a slope is a slope, not a staircase');
  assert.ok(g.isRamp);
  assert.ok(Math.abs(g.slope - 0.5) < 1e-6);
});

test('descending ramps invert along Z', () => {
  const { cs } = buildWorld([
    [-3, 0, 0, 3, 4, 8, KIND.RAMP, FLAG.RAMP_DESC],
  ]);
  assert.ok(Math.abs(cs.rampY(0, 0) - 4) < 1e-6);
  assert.ok(Math.abs(cs.rampY(0, 8) - 0) < 1e-6);
});

test('gapAhead measures the distance to the next hole in the floor', () => {
  const { cs, bp, scratch } = buildWorld([
    [-5, 0, 0, 5, 1, 10],    // floor
    [-5, 0, 14, 5, 1, 30],   // floor resumes after a 4 m gap
  ]);
  const n = bp.query(-1, 31, scratch);
  const d = gapAhead(0, 1, 6, 12, 0.275, cs, scratch, n);
  assert.ok(d >= 3.5 && d <= 4.5, `expected the gap about 4 m ahead, measured ${d}`);

  const none = gapAhead(0, 1, 16, 10, 0.275, cs, scratch, n);
  assert.equal(none, 10, 'continuous ground reports the full probe distance');
});

test('the physics constants keep the reachability math sane', () => {
  // These derived numbers are what the level validator proves gaps against, so
  // a bad retune should fail here rather than produce an unplayable level.
  const apex = (MOVEMENT.jumpVelocity ** 2) / (2 * -MOVEMENT.gravityUp);
  assert.ok(apex > 1.5 && apex < 2.5, `jump apex of ${apex} m is outside the arcade range`);
  assert.ok(-MOVEMENT.gravityDown > -MOVEMENT.gravityUp, 'falling must feel snappier than rising');
});
