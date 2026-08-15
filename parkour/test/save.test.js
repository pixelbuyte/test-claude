/**
 * Save, load, and everything that can go wrong in between.
 *
 * Save data outlives the code that wrote it, and storage is a hostile
 * environment: quotas fill, JSON truncates, private browsing throws on the
 * first access. A player who has been racing for weeks should lose a session at
 * worst, never a profile - so the recovery paths get as much attention as the
 * happy one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { PROGRESSION } from '../src/config.js';
import { SaveManager, memoryAdapter, targetsFor, medalFor } from '../src/sim/save/SaveManager.js';
import { migrate, defaultSave, levelForXp, xpForLevel, SAVE_VERSION } from '../src/sim/save/schema.js';

function fresh() {
  const save = new SaveManager(memoryAdapter());
  save.load();
  return save;
}

test('a fresh profile starts empty but usable', () => {
  const save = fresh();
  assert.equal(save.data.coins, 0);
  assert.equal(save.data.playerLevel, 1);
  assert.equal(save.bestTime('level-01'), null);
  assert.equal(save.recovered, false);
});

test('progress survives a round trip through storage', () => {
  const adapter = memoryAdapter();
  const first = new SaveManager(adapter);
  first.load();
  first.recordRace('level-01', { placement: 2, time: 42.5, coins: 18, deaths: 1 });

  // A completely separate manager over the same storage - as after a reload.
  const second = new SaveManager(adapter);
  second.load();

  assert.equal(second.bestTime('level-01'), 42.5);
  assert.equal(second.data.coins, first.data.coins);
  assert.equal(second.data.xp, first.data.xp);
  assert.equal(second.recovered, false, 'a save we just wrote should load cleanly');
});

test('only a better time replaces the record', () => {
  const save = fresh();
  save.recordRace('level-01', { placement: 1, time: 40 });

  const worse = save.recordRace('level-01', { placement: 3, time: 55 });
  assert.equal(worse.improvedTime, false);
  assert.equal(save.bestTime('level-01'), 40);

  const better = save.recordRace('level-01', { placement: 1, time: 33 });
  assert.equal(better.improvedTime, true);
  assert.equal(save.bestTime('level-01'), 33);
});

test('a DNF counts as a run but never as a best time', () => {
  const save = fresh();
  const out = save.recordRace('level-02', { placement: 4, dnf: true, coins: 5, deaths: 3 });

  assert.equal(out.finished, false);
  assert.equal(save.bestTime('level-02'), null);
  assert.equal(save.levelRecord('level-02').runs, 1);
  assert.equal(save.data.stats.finishes, 0);
  assert.equal(save.data.stats.deaths, 3);
});

test('medals need the time, and only ever improve', () => {
  const targets = targetsFor(60);
  assert.equal(medalFor(59, targets), 'gold');
  assert.equal(medalFor(66, targets), 'silver');
  assert.equal(medalFor(80, targets), 'bronze');
  assert.equal(medalFor(200, targets), null);

  const save = fresh();
  save.recordRace('level-01', { placement: 3, time: 80 }, targets);
  assert.equal(save.levelRecord('level-01').medal, 'bronze');

  save.recordRace('level-01', { placement: 1, time: 59 }, targets);
  assert.equal(save.levelRecord('level-01').medal, 'gold');

  // A worse run must not take the gold away.
  save.recordRace('level-01', { placement: 5, time: 90 }, targets);
  assert.equal(save.levelRecord('level-01').medal, 'gold');
});

test('XP accumulates and levels the player up', () => {
  const save = fresh();
  let out = null;
  for (let i = 0; i < 6; i++) {
    out = save.recordRace('level-01', { placement: 1, time: 40, coins: 30 });
  }

  assert.ok(save.data.xp > 0);
  assert.ok(save.data.playerLevel > 1, 'six wins should be worth at least one level');
  assert.equal(save.data.playerLevel, levelForXp(save.data.xp));
  assert.ok(out.xpToNext >= 0);
});

test('the level curve is monotonic and capped', () => {
  for (let l = 1; l < 12; l++) {
    assert.ok(xpForLevel(l + 1) > xpForLevel(l), `level ${l + 1} costs no more than ${l}`);
  }
  assert.equal(levelForXp(Number.MAX_SAFE_INTEGER), PROGRESSION.maxPlayerLevel);
});

test('overspending is rejected rather than going negative', () => {
  const save = fresh();
  save.data.coins = 50;

  assert.equal(save.spend(80), false, 'spending more than held should fail');
  assert.equal(save.data.coins, 50);

  assert.equal(save.spend(30), true);
  assert.equal(save.data.coins, 20);

  assert.equal(save.spend(-5), false, 'a negative spend must not be a deposit');
  assert.equal(save.data.coins, 20);
});

test('a character is unlocked once, and only if affordable', () => {
  const save = fresh();
  save.data.coins = 100;

  assert.equal(save.unlockCharacter('runner-ash', 60), true);
  assert.equal(save.data.coins, 40);
  assert.equal(save.unlockCharacter('runner-ash', 60), false, 'already owned');
  assert.equal(save.unlockCharacter('runner-vale', 999), false, 'cannot afford');
  assert.equal(save.data.unlockedCharacters.includes('runner-vale'), false);
  assert.equal(save.data.coins, 40, 'a rejected purchase must not charge');
});

// --- Recovery ---------------------------------------------------------------

test('corrupt JSON degrades to a fresh profile instead of throwing', () => {
  const save = new SaveManager(memoryAdapter('{"coins": 40, "levels":'));
  const data = save.load();

  assert.equal(data.coins, 0);
  assert.equal(save.recovered, true, 'the UI needs to know the save was lost');
  assert.deepEqual(Object.keys(data.levels), []);
});

test('storage that throws on read still yields a playable profile', () => {
  const hostile = {
    read() { throw new Error('SecurityError'); },
    write() { throw new Error('SecurityError'); },
    remove() { throw new Error('SecurityError'); },
  };
  const save = new SaveManager(hostile);
  const data = save.load();

  assert.equal(data.playerLevel, 1);
  assert.equal(save.recovered, true);

  // And the session must keep working, just without persistence.
  const out = save.recordRace('level-01', { placement: 1, time: 30 });
  assert.equal(out.persisted, false, 'the caller must learn persistence failed');
  assert.equal(save.bestTime('level-01'), 30, 'in-memory progress still works');
});

test('a full quota loses the write, not the session', () => {
  let stored = null;
  const full = {
    read: () => stored,
    write() { throw new Error('QuotaExceededError'); },
    remove() { stored = null; },
  };
  const save = new SaveManager(full);
  save.load();

  assert.equal(save.save(), false);
  assert.equal(save.writeFailed, true);
  save.recordRace('level-03', { placement: 2, time: 51 });
  assert.equal(save.bestTime('level-03'), 51);
});

test('garbage of the wrong shape migrates to something usable', () => {
  for (const junk of [null, 42, 'hello', [], { levels: 'nope' }, { coins: 'lots' }]) {
    const data = migrate(junk);
    assert.equal(typeof data, 'object');
    assert.equal(data.version, SAVE_VERSION);
    assert.equal(Number.isFinite(data.coins), true, `coins went bad for ${JSON.stringify(junk)}`);
    assert.equal(typeof data.levels, 'object');
    assert.ok(Array.isArray(data.unlockedCharacters));
  }
});

test('a save from a future version keeps what it safely can', () => {
  const future = {
    version: SAVE_VERSION + 5,
    coins: 900,
    xp: 4000,
    somethingNew: { we: 'cannot interpret this' },
  };
  const data = migrate(future);

  assert.equal(data.version, SAVE_VERSION);
  assert.equal(data.coins, 900, 'currency has a stable meaning and should survive');
  assert.equal(data.xp, 4000);
  assert.equal(data.playerLevel, levelForXp(4000));
});

test('player level is derived, not trusted', () => {
  // A hand-edited file claiming level 40 with no XP must not grant it.
  const data = migrate({ version: SAVE_VERSION, xp: 0, playerLevel: 40 });
  assert.equal(data.playerLevel, 1);
});

test('negative and non-finite values are scrubbed on load', () => {
  const data = migrate({
    version: SAVE_VERSION,
    coins: -500,
    xp: NaN,
    levels: { 'level-01': { bestTime: -3, runs: -9, coins: Infinity } },
  });

  assert.equal(data.coins, 0);
  assert.equal(data.xp, 0);
  assert.equal(data.levels['level-01'].bestTime, null, 'a negative best time is not a record');
  assert.equal(data.levels['level-01'].runs, 0);
  assert.equal(Number.isFinite(data.levels['level-01'].coins), true);
});

test('reset clears the profile and the storage behind it', () => {
  const adapter = memoryAdapter();
  const save = new SaveManager(adapter);
  save.load();
  save.recordRace('level-01', { placement: 1, time: 20, coins: 100 });
  assert.ok(save.data.coins > 0);

  save.reset();
  assert.equal(save.data.coins, 0);
  assert.equal(save.bestTime('level-01'), null);

  const reloaded = new SaveManager(adapter);
  reloaded.load();
  assert.equal(reloaded.data.coins, 0, 'the reset did not reach storage');
});

test('unlock gating follows player level', () => {
  const save = fresh();
  assert.equal(save.isUnlocked({ unlockAt: 0 }), true);
  assert.equal(save.isUnlocked({ unlockAt: 9 }), false);

  save.data.playerLevel = 10;
  assert.equal(save.isUnlocked({ unlockAt: 9 }), true);
});
