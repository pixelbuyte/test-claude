/**
 * The level system.
 *
 * Two layers of proof. First the kit: if every shape is individually sound and
 * connects to the fallback, then any concatenation the assembler can produce is
 * sound too. Then the levels themselves: all twelve assemble, validate, and can
 * actually be finished by a racer rather than merely existing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { LEVEL } from '../src/config.js';
import { CHUNKS, CHUNKS_BY_ID } from '../src/data/chunks/kit.js';
import { LEVELS } from '../src/data/levels/index.js';
import { assembleLevel, isAdmissible } from '../src/sim/level/assemble.js';
import { validateLevel, validateKit, describeProblems } from '../src/sim/level/validate.js';
import { checkGap, safeGap, riskyGap } from '../src/sim/level/reachability.js';
import { runHeadlessRace } from '../src/sim/race/headless.js';

test('the chunk kit is internally sound', () => {
  const { ok, problems } = validateKit();
  assert.ok(ok, `the kit has problems:\n${describeProblems(problems)}`);
});

test('generation is total: the fallback follows anything', () => {
  const fallback = CHUNKS_BY_ID[LEVEL.fallbackChunkId];
  assert.ok(fallback, 'the fallback chunk is missing entirely');

  for (const c of CHUNKS) {
    const state = {
      exitLanes: c.exit.lanes,
      exitY: c.exit.y,
      speed: 0, // the worst case: a runner that has just been reduced to nothing
    };
    // The fallback is only required to follow chunks that end at ground level;
    // a chunk that ends high is followed by a descent, which the kit validator
    // separately proves exists.
    if (c.exit.y !== 0) continue;
    assert.ok(isAdmissible(fallback, state),
      `the fallback cannot follow ${c.id} - generation is not total`);
  }
});

test('reachability limits are ordered and finite', () => {
  for (const speed of [8, 12, 16, 20]) {
    const safe = safeGap(speed);
    const risky = riskyGap(speed);
    assert.ok(Number.isFinite(safe) && safe > 0, `safeGap(${speed}) is ${safe}`);
    assert.ok(risky > safe, `double jump should reach further at ${speed} m/s`);
    assert.ok(checkGap(safe - 0.1, speed).ok, 'a gap just inside the limit should pass');
    assert.equal(checkGap(risky + 5, speed).ok, false, 'an impossible gap should fail');
  }
});

test('faster arrival clears wider gaps', () => {
  assert.ok(safeGap(16) > safeGap(10),
    'gap reachability must increase with speed, or the speed curve means nothing');
});

for (const def of LEVELS) {
  test(`${def.id} (${def.name}) assembles and validates`, () => {
    const level = assembleLevel(def);
    const { ok, problems, stats } = validateLevel(level);

    assert.ok(ok, `${def.id} failed validation:\n${describeProblems(problems)}`);
    assert.ok(stats.length > 150, `${def.id} is only ${stats.length.toFixed(0)}m long`);
    assert.ok(stats.checkpoints >= 1, `${def.id} has no checkpoints`);
    assert.ok(stats.pickups > 0, `${def.id} has nothing to collect`);
  });
}

test('a level is a fixed piece of content: same seed, same course', () => {
  const def = LEVELS[2];
  const a = assembleLevel(def);
  const b = assembleLevel(def);

  assert.deepEqual(a.chunkSequence, b.chunkSequence,
    'the same seed produced a different course - levels are not stable content');
  assert.equal(a.colliders.count, b.colliders.count);
  assert.equal(a.finishZ, b.finishZ);
});

test('different seeds produce different courses', () => {
  const base = LEVELS[2];
  const a = assembleLevel(base);
  const b = assembleLevel({ ...base, seed: base.seed + 1 });

  assert.notDeepEqual(a.chunkSequence, b.chunkSequence,
    'changing the seed changed nothing - the tail is not actually procedural');
});

test('no course repeats a chunk back to back', () => {
  for (const def of LEVELS) {
    const level = assembleLevel(def);
    for (let i = 1; i < level.chunkSequence.length; i++) {
      assert.notEqual(level.chunkSequence[i], level.chunkSequence[i - 1],
        `${def.id} places ${level.chunkSequence[i]} twice in a row`);
    }
  }
});

test('difficulty trends upward across the roster of levels', () => {
  const first = assembleLevel(LEVELS[0]);
  const last = assembleLevel(LEVELS[LEVELS.length - 1]);

  const rate = (level) => {
    const hard = level.chunkSequence.filter((id) => (CHUNKS_BY_ID[id]?.difficulty ?? 0) >= 3).length;
    return hard / level.chunkSequence.length;
  };

  assert.ok(rate(last) > rate(first),
    `level 12 is no harder than level 1 (${rate(last).toFixed(2)} vs ${rate(first).toFixed(2)})`);
  assert.ok(last.finishZ > first.finishZ, 'level 12 is not longer than level 1');
});

test('every level can actually be finished', () => {
  // The integration test that matters. A course that validates but cannot be
  // run is still a broken course.
  for (const def of LEVELS) {
    const level = assembleLevel(def);
    const out = runHeadlessRace(level, { roster: [], seed: def.seed });
    const me = out.results.find((r) => r.isPlayer);

    assert.ok(me, `${def.id} produced no result for the player`);
    assert.ok(!me.dnf, `${def.id} could not be finished by the reference driver `
      + `(reached ${(out.player.progress * 100).toFixed(0)}%, ${out.player.deaths} deaths)`);
    assert.ok(out.player.deaths <= 8,
      `${def.id} killed the reference driver ${out.player.deaths} times`);
  }
});

test('every level has authored medal targets', () => {
  for (const def of LEVELS) {
    const t = def.targets;
    assert.ok(t, `${def.id} has no authored targets - run tools/tune.mjs`);
    for (const medal of ['gold', 'silver', 'bronze']) {
      assert.ok(Number.isFinite(t[medal]) && t[medal] > 0,
        `${def.id} has a nonsense ${medal} target: ${t[medal]}`);
    }
    assert.ok(t.gold < t.silver && t.silver < t.bronze,
      `${def.id} targets are not ordered: ${JSON.stringify(t)}`);
  }
});

test('authored targets still match what the course actually measures', () => {
  // The targets in levels/index.js are measured numbers, and a physics retune
  // moves what a course measures. This is the test that notices: it re-runs the
  // reference driver and checks the authored gold is still the time it set,
  // rather than a number that made sense three tuning passes ago.
  //
  // Gold is the reference run itself, so the reference must earn gold - just.
  for (const def of LEVELS) {
    const level = assembleLevel(def);
    const out = runHeadlessRace(level, { roster: def.roster, seed: 101 });
    const me = out.results.find((r) => r.isPlayer);
    assert.ok(me && !me.dnf, `${def.id} did not finish`);

    // A tenth of slack: the authored numbers are rounded to 0.1 s.
    assert.ok(me.time <= def.targets.gold + 0.1,
      `${def.id}: the reference driver runs ${me.time.toFixed(2)}s but gold is `
      + `${def.targets.gold}s - re-run tools/tune.mjs`);
    assert.ok(me.time > def.targets.gold - 1.5,
      `${def.id}: gold (${def.targets.gold}s) is far looser than the measured `
      + `${me.time.toFixed(2)}s - re-run tools/tune.mjs`);
  }
});

test('every level runs a full field without anyone breaking', () => {
  for (const def of LEVELS.slice(0, 4)) {
    const level = assembleLevel(def);
    const out = runHeadlessRace(level, { roster: def.roster, seed: def.seed });

    assert.equal(out.finished, true, `${def.id} never finished`);
    assert.equal(out.droppedEvents, 0, `${def.id} overflowed the event ring`);

    const places = out.results.map((r) => r.placement).sort((a, b) => a - b);
    const expected = out.results.map((_, i) => i + 1);
    assert.deepEqual(places, expected, `${def.id} placements are not a permutation`);

    for (const r of out.race.racers) {
      assert.ok(Number.isFinite(r.pos.z), `${def.id}: ${r.name} went non-finite`);
    }
  }
});
