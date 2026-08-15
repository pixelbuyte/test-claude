/**
 * Headless single-racer rig.
 *
 * Builds a world, drops one racer into it and steps the simulation with
 * scripted intent. Used by the movement and parkour tests, and by the dev
 * sandbox to sanity-check a track without opening a browser.
 *
 * Pure: no renderer, no DOM, no clock. Same code path the real game runs.
 */
import { STEP } from '../../config.js';
import { World } from '../world/World.js';
import { EventQueue, EV, EV_NAME } from '../core/events.js';
import { makeRacer, makeIntent, placeRacer, stepRacer, saveCheckpoint } from '../player/PlayerController.js';
import { STATE, stateName } from '../player/states.js';

export function makeRig(levelData, opts = {}) {
  const world = new World(levelData);
  const p = makeRacer(0, { isPlayer: true, ...opts.racer });
  placeRacer(p, opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
  p.speed = opts.speed ?? 0;
  if (opts.state !== undefined) p.state = opts.state;

  const ev = new EventQueue(1024);
  const log = [];
  let tick = 0;

  const rig = {
    world,
    p,
    ev,
    log,
    get tick() { return tick; },

    /**
     * Runs `count` substeps. `intentFn(i, p)` may mutate and return the shared
     * intent object; anything it does not set keeps last substep's value, which
     * matches how a held button behaves.
     */
    step(count = 1, intentFn = null) {
      const intent = makeIntent();
      for (let i = 0; i < count; i++) {
        intent.jumpPressed = false;
        intent.slidePressed = false;
        if (intentFn) intentFn(intent, i, p);
        world.updateMovers(tick);
        stepRacer(p, intent, world, ev);
        ev.drain((e) => {
          log.push({ type: e.type, name: EV_NAME[e.type], actor: e.actor, a: e.a, b: e.b, c: e.c, tick });
          if (e.type === EV.CHECKPOINT && e.actor === p.index) {
            const cp = world.checkpoints[e.a];
            if (cp) saveCheckpoint(p, cp.index, cp.x, cp.y, cp.z);
          }
        });
        tick++;
      }
      return rig;
    },

    /** Runs until `predicate(p)` is true or the budget is exhausted. */
    stepUntil(predicate, maxSteps = 600, intentFn = null) {
      for (let i = 0; i < maxSteps; i++) {
        if (predicate(p)) return i;
        rig.step(1, intentFn);
      }
      return -1;
    },

    /** Runs `seconds` of simulated time. */
    run(seconds, intentFn = null) {
      return rig.step(Math.round(seconds / STEP), intentFn);
    },

    events(type) {
      return log.filter((e) => e.type === type);
    },

    countOf(type) {
      return rig.events(type).length;
    },

    clearLog() {
      log.length = 0;
      return rig;
    },

    describe() {
      return `${stateName(p.state)} pos=(${p.pos.x.toFixed(2)},${p.pos.y.toFixed(2)},`
        + `${p.pos.z.toFixed(2)}) vel=(${p.vel.x.toFixed(2)},${p.vel.y.toFixed(2)},`
        + `${p.vel.z.toFixed(2)}) speed=${p.speed.toFixed(2)} grounded=${p.grounded}`;
    },
  };

  // Settle onto the ground so tests start from a defined, grounded state. The
  // settle emits its own land event; drop it so a test's event counts only ever
  // describe what the test itself did.
  if (opts.settle !== false) {
    rig.step(opts.settleSteps ?? 6);
    log.length = 0;
  }
  return rig;
}

/** Convenience: an intent that holds a lateral target and nothing else. */
export function steer(target) {
  return (intent) => { intent.lateralTarget = target; };
}

/** Convenience: press jump on substep `at`, hold it for `holdSteps`. */
export function jumpAt(at, holdSteps = 12) {
  return (intent, i) => {
    intent.jumpPressed = i === at;
    intent.jumpHeld = i >= at && i < at + holdSteps;
  };
}

export { STATE, stateName, EV };
