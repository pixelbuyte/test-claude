/**
 * The race, end to end.
 *
 * These are integration tests: a full field, on a real course, run to
 * completion with no renderer. They catch the class of failure a unit test
 * structurally cannot - a course nobody can finish, a field that all crashes at
 * the same crate, a rank that quietly stops being a permutation.
 *
 * The negative case at the bottom matters as much as the rest: a racer that
 * never presses anything must NOT finish, or the whole suite could be passing on
 * a degenerate world.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { RACE, AI } from '../src/config.js';
import { EV } from '../src/sim/core/events.js';
import { buildPracticeLevel } from '../src/data/levels/practice.js';
import { runHeadlessRace, autoPlayer } from '../src/sim/race/headless.js';
import { PHASE } from '../src/sim/race/RaceManager.js';

const ROSTER = [
  { name: 'Vex', skill: 'hard' },
  { name: 'Juno', skill: 'normal' },
  { name: 'Pike', skill: 'normal' },
  { name: 'Sable', skill: 'easy' },
];

function race(opts = {}) {
  return runHeadlessRace(buildPracticeLevel(), { roster: ROSTER, seed: 7, ...opts });
}

test('a full field races the practice course to a finish', () => {
  const out = race();

  assert.equal(out.finished, true, 'the race never reached a finished state');
  assert.equal(out.results.length, 5, 'every racer should appear in the results');
  assert.ok(out.time < RACE.maxTicks / 60, 'the race hit its hard tick cap');
  assert.equal(out.droppedEvents, 0, 'the event ring overflowed');
});

test('placements are always a permutation of the field', () => {
  const out = race();

  const places = out.results.map((r) => r.placement).sort((a, b) => a - b);
  assert.deepEqual(places, [1, 2, 3, 4, 5]);

  const names = new Set(out.results.map((r) => r.name));
  assert.equal(names.size, 5, 'a racer appears twice in the results');
});

test('the live rank order is a permutation at every sample', () => {
  const out = race();

  assert.ok(out.orderChecks.length > 10, 'not enough samples to be meaningful');
  for (const order of out.orderChecks) {
    const sorted = order.slice().sort((a, b) => a - b);
    assert.deepEqual(sorted, [0, 1, 2, 3, 4],
      `rank order stopped being a permutation: ${JSON.stringify(order)}`);
  }
});

test('nobody moves until the countdown ends', () => {
  const level = buildPracticeLevel();
  const out = runHeadlessRace(level, {
    roster: ROSTER,
    seed: 7,
    maxTicks: Math.floor(RACE.countdownSeconds * 60) - 10,
  });

  for (const r of out.race.racers) {
    assert.equal(r.pos.z, r.checkpoint.z, `${r.name} moved during the countdown`);
    assert.equal(r.speed, 0, `${r.name} had speed during the countdown`);
  }
  // The headless runner closes the race when its tick budget runs out, so the
  // phase is no longer COUNTDOWN by the time we look. What matters is that the
  // start was never reached and nobody moved before it.
  assert.ok(!out.counts[EV.RACE_START], 'the race started before the countdown finished');
  assert.ok((out.counts[EV.COUNTDOWN_TICK] || 0) >= 2, 'no countdown was called');
});

test('a racer who never presses anything does not finish', () => {
  // If this ever passes, the course is degenerate and every other test here is
  // measuring nothing.
  const out = runHeadlessRace(buildPracticeLevel(), {
    roster: [],
    seed: 7,
    drive: (intent) => {
      intent.jumpPressed = false;
      intent.jumpHeld = false;
      intent.slidePressed = false;
      intent.slideHeld = false;
      intent.lateralTarget = 0;
    },
    maxTicks: 60 * 120,
  });

  const me = out.results.find((r) => r.isPlayer);
  assert.ok(me.dnf || me.time === null,
    'a player giving no input finished the course - the course asks nothing of them');
});

test('the auto-driven player gets meaningfully round the course', () => {
  const out = runHeadlessRace(buildPracticeLevel(), { roster: [], seed: 7 });
  const me = out.results.find((r) => r.isPlayer);

  assert.ok(!me.dnf, 'the reference driver could not finish the practice course');
  assert.ok(me.time > 15, `finished implausibly fast (${me.time}s)`);
  assert.ok(out.player.deaths <= 4, `died ${out.player.deaths} times getting round`);
});

test('skill ranks the field: hard beats easy across seeds', () => {
  let hardWins = 0;
  const seeds = [1, 2, 3, 5, 8];

  for (const seed of seeds) {
    const out = runHeadlessRace(buildPracticeLevel(), {
      roster: [{ name: 'Hard', skill: 'hard' }, { name: 'Easy', skill: 'easy' }],
      seed,
      drive: null, // no player input at all, so this measures the AI alone
    });
    const hard = out.results.find((r) => r.name === 'Hard');
    const easy = out.results.find((r) => r.name === 'Easy');
    if (hard.placement < easy.placement) hardWins++;
  }

  assert.ok(hardWins >= 4,
    `hard only beat easy on ${hardWins}/${seeds.length} seeds - skill is not ranking the field`);
});

test('the same seed produces an identical race', () => {
  const a = race();
  const b = race();

  assert.equal(a.checksum, b.checksum, 'two runs of the same seed diverged');
  assert.equal(a.ticks, b.ticks);
  assert.deepEqual(a.results.map((r) => r.name), b.results.map((r) => r.name));
});

test('a different seed produces a different race', () => {
  const a = race({ seed: 11 });
  const b = race({ seed: 12 });

  // Not a strict requirement of correctness, but if seeds stop mattering then
  // the AI has stopped drawing from them and the field will feel identical.
  assert.notEqual(a.checksum, b.checksum, 'changing the seed changed nothing');
});

test('opponents obey the same rules as the player', () => {
  const out = race();

  for (const r of out.race.racers) {
    assert.ok(Number.isFinite(r.pos.x) && Number.isFinite(r.pos.y) && Number.isFinite(r.pos.z),
      `${r.name} went non-finite`);
    assert.ok(r.speed >= 0, `${r.name} ran backwards`);
    // Nobody may exceed the speed cap the player is held to, allowing for the
    // profile's speedScale and a boost pad.
    assert.ok(r.speed <= 26, `${r.name} hit ${r.speed.toFixed(1)} m/s`);
    assert.ok(r.pos.y > -100, `${r.name} fell out of the world`);
  }
});

test('a stalled racer is timed out rather than holding the race open', () => {
  const out = runHeadlessRace(buildPracticeLevel(), {
    roster: [{ name: 'Ghost', skill: 'easy' }],
    seed: 3,
  });

  assert.equal(out.finished, true);
  // Whether by finishing or by DNF, everyone must be placed.
  for (const r of out.results) {
    assert.ok(r.placement >= 1 && r.placement <= out.results.length,
      `${r.name} ended with placement ${r.placement}`);
  }
});
