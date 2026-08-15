/**
 * The guided tutorial.
 *
 * Two things have to be true and neither is obvious from reading the code. A
 * hint must fire exactly once ever, even though the affordance that triggers it
 * stays true for dozens of substeps and survives a reload. And a hint must
 * never promise a move the runner cannot actually make - the wall-run hint in
 * particular has to agree with the parkour state machine about what counts as a
 * wall-run, or it teaches the player that the move is broken.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { PARKOUR } from '../src/config.js';
import { TUTORIAL_HINTS, TUTORIAL_IDS } from '../src/data/tutorial.js';
import { TutorialDirector } from '../src/app/tutorial.js';
import { makeAffordanceSet } from '../src/sim/player/affordances.js';
import { makeRacer } from '../src/sim/player/PlayerController.js';
import { migrate, defaultSave } from '../src/sim/save/schema.js';

function scene() {
  const a = makeAffordanceSet();
  const p = makeRacer(0, { isPlayer: true, name: 'You' });
  p.grounded = true;
  p.speed = 14;
  p.baseSpeed = 14;
  return { a, p };
}

/** Runs the director for `frames` substeps against an unchanging world. */
function run(dir, a, p, frames, dt = 1 / 60) {
  const shown = [];
  for (let i = 0; i < frames; i++) {
    const hint = dir.update(a, p, dt);
    if (hint) shown.push(hint.id);
  }
  return shown;
}

test('every hint has an id, a sentence and a predicate', () => {
  assert.ok(TUTORIAL_HINTS.length >= 5);
  const ids = new Set();
  for (const h of TUTORIAL_HINTS) {
    assert.equal(typeof h.id, 'string');
    assert.ok(h.text.length > 8, `${h.id} has no useful text`);
    assert.equal(typeof h.when, 'function');
    assert.ok(!ids.has(h.id), `duplicate hint id ${h.id}`);
    ids.add(h.id);
  }
  assert.deepEqual(TUTORIAL_IDS, TUTORIAL_HINTS.map((h) => h.id));
  for (const id of ['vault', 'slide', 'wallrun', 'gap', 'launch']) {
    assert.ok(ids.has(id), `no hint covers ${id}`);
  }
});

test('nothing fires in an empty world', () => {
  const { a, p } = scene();
  const dir = new TutorialDirector({});
  assert.deepEqual(run(dir, a, p, 600), []);
  assert.equal(dir.remaining.length, TUTORIAL_IDS.length);
});

test('a hint fires once however long the affordance stays true', () => {
  const { a, p } = scene();
  a.slideNeeded = true;
  const dir = new TutorialDirector({});
  // Ten seconds of running at a bar that is always in front of you.
  assert.deepEqual(run(dir, a, p, 600), ['slide']);
});

test('a hint never fires again in a later race', () => {
  const seen = {};
  const first = new TutorialDirector(seen);
  const { a, p } = scene();
  a.slideNeeded = true;
  assert.deepEqual(run(first, a, p, 120), ['slide']);

  // A fresh director over the same save data - as after a restart.
  const second = new TutorialDirector(seen);
  assert.deepEqual(run(second, a, p, 600), []);
});

test('a second hint waits for the first to be read', () => {
  const { a, p } = scene();
  const dir = new TutorialDirector({});
  a.slideNeeded = true;
  a.gapDistance = 4; a.gapValid = true;

  // Same substep, both true: only the more time-critical one goes out.
  assert.deepEqual(run(dir, a, p, 1), ['slide']);
  // And the other is held back for the cooldown, not dropped.
  assert.deepEqual(run(dir, a, p, Math.round(dir.cooldown * 60) - 2), []);
  assert.deepEqual(run(dir, a, p, 4), ['gap']);
});

test('the wall-run hint agrees with the parkour state machine', () => {
  const { a, p } = scene();
  a.wallLeftValid = true;

  // Grounded beside a wall is not a wall-run.
  const grounded = new TutorialDirector({});
  assert.deepEqual(run(grounded, a, p, 300), []);

  // Airborne but too slow is not a wall-run either - canWallRun requires
  // speed >= baseSpeed * wallRunMinSpeedFactor.
  p.grounded = false;
  p.speed = p.baseSpeed * (PARKOUR.wallRunMinSpeedFactor - 0.1);
  const slow = new TutorialDirector({});
  assert.deepEqual(run(slow, a, p, 300), []);

  // Airborne, beside the wall, fast enough: now it is a real offer.
  p.speed = p.baseSpeed * PARKOUR.wallRunMinSpeedFactor;
  const ok = new TutorialDirector({});
  assert.deepEqual(run(ok, a, p, 300), ['wallrun']);
});

test('the gap hint waits until the runner is on the ground to take off from', () => {
  const { a, p } = scene();
  a.gapDistance = 5; a.gapValid = true;
  p.grounded = false;
  const airborne = new TutorialDirector({});
  assert.deepEqual(run(airborne, a, p, 300), []);

  p.grounded = true;
  const landed = new TutorialDirector({});
  assert.deepEqual(run(landed, a, p, 300), ['gap']);
});

test('the whole set plays out over one long course, in order of encounter', () => {
  const { a, p } = scene();
  const dir = new TutorialDirector({});
  const shown = [];
  const meet = (fn, frames = 240) => {
    fn();
    for (let i = 0; i < frames; i++) {
      const h = dir.update(a, p, 1 / 60);
      if (h) shown.push(h.id);
    }
  };

  meet(() => { a.vaultIndex = 3; });
  meet(() => { a.vaultIndex = -1; a.slideNeeded = true; });
  meet(() => { a.slideNeeded = false; a.gapDistance = 6; a.gapValid = true; });
  meet(() => { a.gapDistance = 0; a.gapValid = false; p.grounded = false; a.wallRightValid = true; });
  meet(() => { p.grounded = true; a.wallRightValid = false; a.launchValid = true; });

  assert.deepEqual(shown, ['vault', 'slide', 'gap', 'wallrun', 'launch']);
  assert.equal(dir.complete, true);
  assert.deepEqual(dir.remaining, []);
});

test('the toggle silences hints without consuming them', () => {
  const { a, p } = scene();
  a.slideNeeded = true;
  const dir = new TutorialDirector({});
  dir.enabled = false;
  assert.deepEqual(run(dir, a, p, 600), []);
  assert.equal(dir.remaining.includes('slide'), true, 'a silenced hint is not a spent one');

  dir.enabled = true;
  assert.deepEqual(run(dir, a, p, 60), ['slide']);
});

test('replay puts every hint back', () => {
  const seen = {};
  for (const id of TUTORIAL_IDS) seen[id] = true;
  const dir = new TutorialDirector(seen);
  assert.equal(dir.complete, true);

  dir.replay();
  assert.equal(dir.complete, false);
  assert.deepEqual(seen, {}, 'replay should clear the map, not just ignore it');

  const { a, p } = scene();
  a.slideNeeded = true;
  assert.deepEqual(run(dir, a, p, 60), ['slide']);
});

test('rebinding follows a reset profile rather than writing into the old one', () => {
  const before = { slide: true };
  const dir = new TutorialDirector(before);
  assert.equal(dir.remaining.includes('slide'), false);

  // What `save.reset()` does: a whole new save object, and a new empty map.
  const after = defaultSave().tutorialSeen;
  dir.rebind(after);
  assert.equal(dir.remaining.length, TUTORIAL_IDS.length);

  const { a, p } = scene();
  a.slideNeeded = true;
  assert.deepEqual(run(dir, a, p, 60), ['slide']);
  assert.deepEqual(after, { slide: true }, 'the new map is the one being written');
  assert.deepEqual(before, { slide: true }, 'the old map is left alone');
});

test('a save written before the tutorial existed still shows the hints', () => {
  // Exactly the shape a v1 save had before `tutorialSeen` was added.
  const old = {
    version: 1,
    coins: 400,
    xp: 900,
    characterId: 'runner-ember',
    unlockedCharacters: ['runner-ember'],
    levels: { 'level-01': { bestTime: 21.5, runs: 4, finished: true } },
    settings: { audio: false },
    stats: { races: 4 },
  };
  const out = migrate(old);
  assert.deepEqual(out.tutorialSeen, {}, 'an older save must not arrive pre-taught');
  assert.equal(out.settings.tutorialHints, true, 'and hints default to on');
  // The rest of the profile has to survive intact.
  assert.equal(out.coins, 400);
  assert.equal(out.settings.audio, false);
  assert.equal(out.levels['level-01'].bestTime, 21.5);

  const dir = new TutorialDirector(out.tutorialSeen);
  assert.equal(dir.remaining.length, TUTORIAL_IDS.length);
});

test('a hand-edited tutorialSeen is filtered down to what the game knows', () => {
  const out = migrate({
    version: 1,
    tutorialSeen: { slide: true, vault: 'yes', bogus: true, other: 1 },
  });
  assert.deepEqual(out.tutorialSeen, { slide: true },
    'only known ids, only literal true');
});

test('tutorialSeen survives a normal round trip', () => {
  const save = defaultSave();
  save.tutorialSeen.vault = true;
  save.tutorialSeen.gap = true;
  const out = migrate(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(out.tutorialSeen, { vault: true, gap: true });
});

test('a nonsense tutorialSeen degrades to empty rather than throwing', () => {
  for (const bad of [null, 42, 'seen', [], undefined]) {
    assert.deepEqual(migrate({ version: 1, tutorialSeen: bad }).tutorialSeen, {});
  }
});
