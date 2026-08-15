/**
 * Runs a whole race with no renderer.
 *
 * This is the tool that makes difficulty tunable by measurement rather than by
 * feel: a level's target times come from actually racing it a few hundred times,
 * not from guessing. It is also the integration test that catches the failures
 * unit tests structurally cannot - a level nobody can finish, a field that all
 * crashes at the same crate, a rank that stops being a permutation.
 */
import { RACE, PARKOUR } from '../../config.js';
import { World } from '../world/World.js';
import { EventQueue, EV } from '../core/events.js';
import { RaceManager, PHASE } from './RaceManager.js';
import { makeRacer, makeIntent } from '../player/PlayerController.js';
import { STATE } from '../player/states.js';
import { checksumRacers } from '../core/checksum.js';

/**
 * A reasonable default driver for the human slot.
 *
 * Deliberately not perfect: it reacts to affordances the same way the AI does,
 * so a headless race measures the course rather than a scripted ideal line.
 */
export function autoPlayer(intent, p) {
  const a = p.affordances;
  intent.jumpPressed = false;
  intent.slidePressed = false;

  const onWall = p.state === STATE.WALLRUN;
  const gapClose = a.gapDistance > 0 && a.gapDistance < Math.max(1.5, p.speed * 0.2);
  const needsHop = a.blockerValid && !a.vaultValid && p.grounded;
  // Crucially not while already wall-running: pressing jump on the wall is a
  // wall-jump, which throws the runner straight back off it. Ride it, then leave
  // deliberately near the end.
  const wallAvailable = !p.grounded && !onWall && (a.wallLeftValid || a.wallRightValid);
  const leavingWall = onWall && p.stateTime > PARKOUR.wallRunMaxTime * 0.7;

  // A gap with a wall beside it is a wall-run, not a jump - and it has to be
  // approached before it can be latched onto.
  const wallRoute = (a.wallNearLeft || a.wallNearRight) && a.gapDistance > 0
    && a.gapDistance < 16;

  if ((gapClose && p.grounded) || needsHop || wallAvailable || leavingWall) {
    intent.jumpPressed = true;
    intent.jumpHeld = true;
  } else if (p.vel.y <= 0) {
    intent.jumpHeld = false;
  }

  if (a.slideNeeded && p.grounded) {
    intent.slidePressed = true;
    intent.slideHeld = true;
  } else if (!a.slideNeeded) {
    intent.slideHeld = false;
  }

  if (a.wallLeftValid) intent.lateralTarget = -1;
  else if (a.wallRightValid) intent.lateralTarget = 1;
  else if (wallRoute) intent.lateralTarget = a.wallNearLeft ? -1 : 1;
  else intent.lateralTarget = 0;

  return intent;
}

/**
 * @param {object} level    assembled level data
 * @param {object} opts     { roster, seed, drive, maxTicks, collectEvents }
 * @returns race results plus diagnostics
 */
export function runHeadlessRace(level, opts = {}) {
  const world = new World(level);
  const player = makeRacer(0, { isPlayer: true, name: opts.playerName || 'Player' });
  const race = new RaceManager(world, player, opts.roster || [], { seed: opts.seed ?? 1 });

  const ev = new EventQueue(1024);
  const intent = makeIntent();
  const drive = opts.drive === undefined ? autoPlayer : opts.drive;
  const maxTicks = opts.maxTicks ?? RACE.maxTicks;

  const counts = Object.create(null);
  const collected = opts.collectEvents ? [] : null;
  /** Rank order sampled each substep, so a test can assert it never degenerates. */
  const orderChecks = [];

  let dropped = 0;
  while (race.phase !== PHASE.FINISHED && race.tick < maxTicks) {
    if (drive) drive(intent, player, world);
    race.step(intent, ev);

    ev.drain((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
      if (collected) collected.push({ type: e.type, actor: e.actor, a: e.a, b: e.b, c: e.c });
    });
    dropped += ev.dropped;
    ev.dropped = 0;

    if (race.tick % 30 === 0) orderChecks.push(race.order.slice());
  }

  // Stopping on our own tick budget still has to produce a complete result set,
  // or a caller measuring a course gets an empty array and no explanation.
  if (race.phase !== PHASE.FINISHED) {
    race.end(ev);
    ev.drain(() => {});
  }

  return {
    race,
    world,
    player,
    results: race.results(),
    time: race.time,
    ticks: race.tick,
    finished: race.phase === PHASE.FINISHED,
    counts,
    events: collected,
    orderChecks,
    droppedEvents: dropped,
    checksum: checksumRacers(race.racers),
  };
}

/** Convenience for tuning: the player's finish time, or null for a DNF. */
export function measureTime(level, opts = {}) {
  const out = runHeadlessRace(level, opts);
  const me = out.results.find((r) => r.isPlayer);
  return me && !me.dnf ? me.time : null;
}
