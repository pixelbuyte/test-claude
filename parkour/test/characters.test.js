/**
 * Characters and the rules for owning them.
 *
 * Every character shares the one rig, so a character is a palette plus a price.
 * What is worth testing is the economy around it: you cannot buy what you cannot
 * afford, you cannot buy the same thing twice, and a level gate is not something
 * money can skip.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CHARACTERS, character, purchaseState } from '../src/data/characters.js';
import { SaveManager, memoryAdapter } from '../src/sim/save/SaveManager.js';

function fresh() {
  const save = new SaveManager(memoryAdapter());
  save.load();
  return save;
}

test('the roster is well formed and starts with a free runner', () => {
  assert.ok(CHARACTERS.length >= 4);

  const ids = new Set();
  for (const c of CHARACTERS) {
    assert.ok(!ids.has(c.id), `duplicate character id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.name, 'string');
    assert.ok(c.name.length > 0);
    assert.ok(Number.isInteger(c.primary) && Number.isInteger(c.accent));
    assert.ok(c.cost >= 0);
    assert.ok(c.unlockAt >= 0);
  }

  const free = CHARACTERS.filter((c) => c.cost === 0 && c.unlockAt === 0);
  assert.ok(free.length >= 1, 'a new player must have something to run as');
});

test('the default save owns exactly the free runner', () => {
  const save = fresh();
  assert.deepEqual(save.data.unlockedCharacters, ['runner-ember']);
  assert.equal(save.data.characterId, 'runner-ember');
  assert.equal(purchaseState(CHARACTERS[0], save).owned, true);
});

test('an unknown id falls back rather than returning undefined', () => {
  // The renderer indexes straight into this; undefined would be a blank runner.
  assert.equal(character('nonsense').id, CHARACTERS[0].id);
  assert.equal(character(undefined).id, CHARACTERS[0].id);
});

test('cost gates a purchase, and buying charges exactly once', () => {
  const save = fresh();
  const ash = CHARACTERS.find((c) => c.id === 'runner-ash');

  assert.equal(purchaseState(ash, save).affordable, false, 'broke players cannot buy');
  assert.equal(save.unlockCharacter(ash.id, ash.cost), false);

  save.data.coins = ash.cost + 10;
  assert.equal(purchaseState(ash, save).affordable, true);
  assert.equal(save.unlockCharacter(ash.id, ash.cost), true);
  assert.equal(save.data.coins, 10, 'the price should have been charged once');

  // And again is a no-op rather than a second charge.
  assert.equal(save.unlockCharacter(ash.id, ash.cost), false);
  assert.equal(save.data.coins, 10);
});

test('a level gate cannot be bought past', () => {
  const save = fresh();
  const gated = CHARACTERS.find((c) => c.unlockAt > 0);
  save.data.coins = 999999;

  const state = purchaseState(gated, save);
  assert.equal(state.locked, true, 'a gated runner must read as locked, not merely pricey');
  assert.ok(state.reason.includes('Level'));

  save.data.playerLevel = gated.unlockAt;
  assert.equal(purchaseState(gated, save).locked, undefined);
  assert.equal(purchaseState(gated, save).affordable, true);
});

test('ownership survives a reload', () => {
  const adapter = memoryAdapter();
  const first = new SaveManager(adapter);
  first.load();
  first.data.coins = 5000;
  first.unlockCharacter('runner-ash', 250);
  first.data.characterId = 'runner-ash';
  first.save();

  const second = new SaveManager(adapter);
  second.load();
  assert.ok(second.data.unlockedCharacters.includes('runner-ash'));
  assert.equal(second.data.characterId, 'runner-ash');
  assert.equal(purchaseState(character('runner-ash'), second).owned, true);
});

test('prices and gates rise together across the roster', () => {
  // Otherwise a later runner is a cheaper choice than an earlier one, and the
  // progression stops meaning anything.
  for (let i = 1; i < CHARACTERS.length; i++) {
    assert.ok(CHARACTERS[i].cost >= CHARACTERS[i - 1].cost,
      `${CHARACTERS[i].id} costs less than the one before it`);
    assert.ok(CHARACTERS[i].unlockAt >= CHARACTERS[i - 1].unlockAt,
      `${CHARACTERS[i].id} unlocks earlier than the one before it`);
  }
});
