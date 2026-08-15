/**
 * Power-ups.
 *
 * The rule under the most scrutiny here is slow-mo: it scales what opponents
 * *do*, never how time advances. Scaling the timestep would desynchronise the
 * fixed step, break the determinism checksum, and make every recorded time
 * incomparable - so there is a test asserting the step length never moves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { STEP, POWERUPS, KIND, FLAG } from '../src/config.js';
import { EV } from '../src/sim/core/events.js';
import { LevelBuilder } from '../src/sim/level/builder.js';
import { makeRig } from '../src/sim/testing/rig.js';
import { makeRacer } from '../src/sim/player/PlayerController.js';
import {
  POWERUP, grant, stepPowerUps, clearPowerUps, activeEffects, powerupId,
} from '../src/sim/systems/PowerUpSystem.js';
import { World } from '../src/sim/world/World.js';
import { EventQueue } from '../src/sim/core/events.js';
import { runHeadlessRace } from '../src/sim/race/headless.js';

function track(opts = {}) {
  const b = new LevelBuilder({ levelId: 'powerups', ...opts });
  b.floor(-10, 300, 0);
  b.section(-10, 340, -30);
  b.finishZ = 280;
  return b;
}

test('names map to ids, and unknown names do not crash', () => {
  assert.equal(powerupId('shield'), POWERUP.SHIELD);
  assert.equal(powerupId('slowmo'), POWERUP.SLOWMO);
  assert.equal(powerupId('nonsense'), POWERUP.SPEED, 'unknown falls back rather than throwing');
});

test('a shield absorbs exactly one crash', () => {
  const b = track();
  b.box(-5, 0, 40, 5, 4, 42, { kind: KIND.SOLID });
  b.box(-5, 0, 80, 5, 4, 82, { kind: KIND.SOLID });
  const rig = makeRig(b.build(), { speed: 12, z: 30 });
  const p = rig.p;

  grant(p, POWERUP.SHIELD);
  assert.equal(p.shield, POWERUPS.shield.absorbs);

  rig.run(1.5, () => {});

  assert.equal(rig.countOf(EV.SHIELD_ABSORB), 1, 'the shield should have absorbed the hit');
  assert.equal(p.shield, 0, 'and been spent doing it');
  assert.equal(rig.countOf(EV.CRASH), 0, 'an absorbed hit is not also a crash');
});

test('once the shield is spent the next hit is a real crash', () => {
  const b = track();
  b.box(-5, 0, 40, 5, 4, 42, { kind: KIND.SOLID });
  const rig = makeRig(b.build(), { speed: 12, z: 30 });
  const p = rig.p;

  clearPowerUps(p);
  rig.run(1.5, () => {});

  assert.equal(rig.countOf(EV.SHIELD_ABSORB), 0);
  assert.ok(rig.countOf(EV.CRASH) >= 1, 'with no shield, hitting a wall must crash');
});

test('shields stack as a count, not as a longer timer', () => {
  const p = makeRacer(0, {});
  grant(p, POWERUP.SHIELD);
  grant(p, POWERUP.SHIELD);
  assert.equal(p.shield, 2, 'a second shield is a second absorbed crash');
});

test('a speed power-up raises the target speed and then expires', () => {
  // Flat speed curve: the course's own ramp would otherwise rise underneath the
  // measurement and hide whether the power-up ever lifted.
  const level = track({ speedCurve: { start: 10, base: 10, max: 10, accelPerSec: 0 } }).build();
  const rig = makeRig(level, { speed: 10, z: 0 });
  const p = rig.p;

  rig.run(1);
  const plain = p.speed;

  grant(p, POWERUP.SPEED);
  rig.run(1);
  const boosted = p.speed;

  assert.ok(boosted > plain + 1,
    `speed power-up did nothing: ${plain.toFixed(2)} -> ${boosted.toFixed(2)}`);

  // Run well past the duration; it must come back down on its own.
  rig.run(POWERUPS.speed.duration + 2);
  assert.ok(p.speed < boosted,
    'the speed power-up never expired');
  assert.equal(p.speedTimer <= 0, true);
});

test('the magnet pulls uncollected coins and stops when it expires', () => {
  const b = track();
  for (let z = 40; z < 60; z += 2) b.coin(4.5, 1.2, z);
  const world = new World(b.build());
  const p = makeRacer(0, { isPlayer: true });
  p.pos.x = 0; p.pos.y = 0; p.pos.z = 38;
  const ev = new EventQueue(256);

  grant(p, POWERUP.MAGNET);
  // Without moving at all, the magnet alone should hoover up what is in range.
  stepPowerUps([p], p, world, ev);
  assert.ok(ev.countOf(EV.COIN) > 0, 'the magnet pulled nothing');

  const pulled = ev.countOf(EV.COIN);
  ev.clear();
  clearPowerUps(p);
  stepPowerUps([p], p, world, ev);
  assert.equal(ev.countOf(EV.COIN), 0, 'the magnet kept pulling after being cleared');
  assert.ok(pulled > 0);
});

test('a coin can only be collected once', () => {
  const b = track();
  b.coin(0, 1.2, 40);
  const world = new World(b.build());
  const p = makeRacer(0, { isPlayer: true });
  p.pos.z = 38;
  const ev = new EventQueue(256);

  grant(p, POWERUP.MAGNET);
  stepPowerUps([p], p, world, ev);
  const first = ev.countOf(EV.COIN);
  ev.clear();
  stepPowerUps([p], p, world, ev);

  assert.equal(first, 1);
  assert.equal(ev.countOf(EV.COIN), 0, 'the same coin was collected twice');
});

test('slow-mo scales opponents, and never the timestep', () => {
  const world = new World(track().build());
  const player = makeRacer(0, { isPlayer: true });
  const rival = makeRacer(1, {});
  const ev = new EventQueue(256);
  const stepBefore = STEP;

  grant(player, POWERUP.SLOWMO);
  stepPowerUps([player, rival], player, world, ev);

  assert.equal(rival.slowFactor, POWERUPS.slowmo.opponentScale,
    'slow-mo must scale the opponent');
  assert.equal(player.slowFactor, 1, 'and never the player who used it');
  assert.equal(STEP, stepBefore, 'the fixed timestep must not move - ever');

  // Expire it.
  player.slowmoTimer = 0;
  stepPowerUps([player, rival], player, world, ev);
  assert.equal(rival.slowFactor, 1, 'slow-mo never lifted');
});

test('slow-mo actually costs the opponent distance', () => {
  const build = () => {
    const rig = makeRig(track().build(), { speed: 12, z: 0 });
    return rig;
  };

  const normal = build();
  normal.run(3);

  const slowed = build();
  slowed.p.slowFactor = POWERUPS.slowmo.opponentScale;
  slowed.run(3, () => { slowed.p.slowFactor = POWERUPS.slowmo.opponentScale; });

  assert.ok(slowed.p.pos.z < normal.p.pos.z - 2,
    `slow-mo made no difference: ${slowed.p.pos.z.toFixed(1)} vs ${normal.p.pos.z.toFixed(1)}`);
});

test('an air-boost is instant, refreshes the double jump, and is not "active"', () => {
  const p = makeRacer(0, {});
  p.vel.y = -4;
  p.canDoubleJump = false;
  p.grounded = true;

  grant(p, POWERUP.AIRBOOST);

  assert.equal(p.vel.y, POWERUPS.airboost.impulse);
  assert.equal(p.canDoubleJump, true, 'an air-boost should give the air move back');
  assert.equal(p.grounded, false);
  assert.equal(p.activePowerup, -1,
    'an instant effect must not displace a shield the player is holding');
});

test('dying clears the power-ups you were holding', () => {
  const b = track();
  b.checkpoint(10);
  // A pit: fall in and die.
  const level = b.build();
  const rig = makeRig(level, { speed: 12, z: 0 });
  const p = rig.p;

  grant(p, POWERUP.SHIELD);
  grant(p, POWERUP.SPEED);
  assert.ok(p.shield > 0 && p.speedTimer > 0);

  // Drop the racer far below the floor to force the fall death.
  p.pos.y = -200;
  rig.run(1.5, () => {});

  assert.equal(rig.countOf(EV.DEATH), 1);
  assert.equal(p.shield, 0, 'a shield must not survive the death it failed to prevent');
  assert.equal(p.speedTimer, 0);
});

test('activeEffects reports what the HUD needs', () => {
  const p = makeRacer(0, {});
  assert.deepEqual(activeEffects(p), { shield: 0, speed: 0, magnet: 0, slowmo: 0, invuln: 0 });

  grant(p, POWERUP.SHIELD);
  grant(p, POWERUP.MAGNET);
  const effects = activeEffects(p);
  assert.equal(effects.shield, 1);
  assert.ok(effects.magnet > 0);
});

test('power-ups are reachable in a real race and do not break it', () => {
  const b = track();
  b.powerup(0, 1.2, 30, 'shield');
  b.powerup(0, 1.2, 60, 'magnet');
  b.powerup(0, 1.2, 90, 'speed');
  b.shard(0, 1.2, 120);
  b.finish(200);
  const level = b.build();

  const out = runHeadlessRace(level, { roster: [{ name: 'Rival', skill: 'normal' }], seed: 5 });
  const me = out.results.find((r) => r.isPlayer);

  assert.equal(out.finished, true);
  assert.ok(!me.dnf, 'the course became unfinishable with power-ups on it');
  assert.ok((out.counts[EV.POWERUP_PICKUP] || 0) >= 1, 'nobody picked up a power-up');
  assert.equal(out.droppedEvents, 0);
  assert.ok(out.player.shards >= 0);
});

test('one pickup produces exactly one event', () => {
  const b = track();
  b.powerup(0, 1.2, 30, 'shield');
  b.finish(80);
  const out = runHeadlessRace(b.build(), { roster: [], seed: 5 });

  assert.equal(out.counts[EV.POWERUP_PICKUP], 1,
    'the pickup was double-counted - the system is emitting a second event');
});
