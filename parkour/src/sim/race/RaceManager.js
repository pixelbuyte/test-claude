/**
 * The race itself.
 *
 * Owns the field, the clock and the rules: who is where, who has finished, when
 * the race is over. It advances every racer through the same `stepRacer` - the
 * player's intent comes from a thumb, an opponent's from `thinkAI`, and after
 * that point nothing distinguishes them.
 *
 * Entirely pure, so a full field can be raced headlessly in Node. That is what
 * makes target times and difficulty tunable by measurement rather than by feel.
 */
import { STEP, RACE } from '../../config.js';
import { EV } from '../core/events.js';
import { stepRacer, placeRacer, consumeEdges, saveCheckpoint, applyBoost } from '../player/PlayerController.js';
import { thinkAI, makeField } from '../ai/AIController.js';
import { stepPowerUps, collectPowerup } from '../systems/PowerUpSystem.js';
import { STATE } from '../player/states.js';

export const PHASE = {
  COUNTDOWN: 0,
  RUNNING: 1,
  FINISHED: 2,
};

export class RaceManager {
  /**
   * @param {World} world
   * @param {object} player   the human racer
   * @param {object[]} roster opponent definitions
   * @param {object} opts     { seed, countdown }
   */
  constructor(world, player, roster = [], opts = {}) {
    this.world = world;
    this.player = player;
    this.seed = opts.seed ?? 1;

    this.field = makeField(roster, this.seed);
    /** Everyone, player first. Index in this array is the racer's identity. */
    this.racers = [player, ...this.field.map((ai) => ai.racer)];

    this.phase = PHASE.COUNTDOWN;
    this.countdown = opts.countdown ?? RACE.countdownSeconds;
    this.lastCountdownCall = Math.ceil(this.countdown);
    this.time = 0;
    this.tick = 0;

    /** Racer indices in rank order. Always a permutation of 0..n-1. */
    this.order = this.racers.map((_, i) => i);
    this.placements = new Array(this.racers.length).fill(0);
    this.finishOrder = [];
    this.leaderFinishTime = -1;

    this._placeField();
  }

  /** Spreads the field across the start line, player in the middle. */
  _placeField() {
    const z = this.world.startZ + 2;
    const lanes = [0, -1.6, 1.6, -3.0, 3.0, -2.3, 2.3, -0.8];
    for (let i = 0; i < this.racers.length; i++) {
      const r = this.racers[i];
      // Stagger backwards slightly so nobody starts inside anybody else.
      placeRacer(r, lanes[i % lanes.length], 0, z - Math.floor(i / lanes.length) * 1.8);
      r.speed = 0;
      r.state = STATE.IDLE;
    }
  }

  /**
   * Advances the whole race by one fixed substep.
   *
   * @param {object} playerIntent  filled by the input layer
   * @param {EventQueue} ev
   */
  step(playerIntent, ev) {
    if (this.phase === PHASE.COUNTDOWN) {
      this.countdown -= STEP;
      const call = Math.ceil(this.countdown);
      if (call !== this.lastCountdownCall && call >= 0) {
        this.lastCountdownCall = call;
        ev.push(EV.COUNTDOWN_TICK, -1, call);
      }
      if (this.countdown <= 0) {
        this.phase = PHASE.RUNNING;
        ev.push(EV.RACE_START, -1);
      }
      this.tick++;
      return;
    }

    if (this.phase === PHASE.FINISHED) return;

    this.world.updateMovers(this.tick);

    // Player first so its events read in a sensible order in the log.
    stepRacer(this.player, playerIntent, this.world, ev);
    consumeEdges(playerIntent);

    for (let i = 0; i < this.field.length; i++) {
      const ai = this.field[i];
      const intent = thinkAI(ai, this.world);
      stepRacer(ai.racer, intent, this.world, ev);
    }

    // After everyone has moved: magnet range and slow-mo both depend on where
    // the field actually ended up this substep.
    stepPowerUps(this.racers, this.player, this.world, ev);

    this._resolveEvents(ev);
    this._updateOrder(ev);
    this._checkRaceEnd(ev);

    this.tick++;
    this.time += STEP;
  }

  /**
   * Applies the consequences that belong to the race rather than to one racer:
   * checkpoints, pickups, boost pads and finishes.
   */
  _resolveEvents(ev) {
    // Peek, not drain: the view layer needs to see these same events afterwards.
    ev.peek((e) => {
      const r = this.racers[e.actor];
      if (!r) return;

      switch (e.type) {
        case EV.CHECKPOINT: {
          const cp = this.world.checkpoints[e.a];
          if (cp) saveCheckpoint(r, cp.index, cp.x, cp.y, cp.z);
          break;
        }
        case EV.COIN:
          r.coins += e.c || 1;
          break;
        case EV.SHARD:
          r.shards += e.c || 1;
          break;
        case EV.BOOST_PAD:
          applyBoost(r);
          break;
        case EV.POWERUP_PICKUP:
          // The world reported *which pickup* was touched; the system decides
          // what it means and writes the kind back into the same record, so the
          // view drains one event that says both. No second event, no
          // double-count.
          e.b = collectPowerup(r, this.world, e.a);
          break;
        case EV.FINISH:
          this._finish(r);
          break;
        default:
          break;
      }
    });
  }

  /**
   * The world pushes FINISH when a racer sweeps the line; this turns that into a
   * placement. It deliberately does not push a second FINISH - consumers read
   * `placement` and `finishTime` off the racer, so there is exactly one event
   * per crossing.
   */
  _finish(r) {
    if (r.finished) return;
    r.finished = true;
    // The clock stops at the line, and the penalty for every respawn is added
    // there rather than paid during the run - so the HUD clock stays honest.
    r.finishTime = this.time + r.timePenalty;
    this.finishOrder.push(r.index);
    r.placement = this.finishOrder.length;
    if (this.leaderFinishTime < 0) this.leaderFinishTime = this.time;
  }

  /**
   * Ranks the field. Finishers rank by finish order; everyone else by distance
   * along the course, which is exactly `progress` - the reason Z is required to
   * be monotonic.
   */
  _updateOrder(ev) {
    const racers = this.racers;
    this.order.sort((ia, ib) => {
      const a = racers[ia];
      const b = racers[ib];
      if (a.finished && b.finished) return a.placement - b.placement;
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (b.progress !== a.progress) return b.progress - a.progress;
      // Stable tiebreak, so equal progress never produces a flickering rank.
      return ia - ib;
    });

    for (let rank = 0; rank < this.order.length; rank++) {
      const idx = this.order[rank];
      const r = racers[idx];
      const next = rank + 1;
      if (r.placement !== next && !r.finished) {
        if (r.placement !== 0 && r.index === this.player.index) {
          ev.push(EV.RANK_CHANGE, r.index, next, r.placement);
        }
        r.placement = next;
      }
    }
  }

  _checkRaceEnd(ev) {
    if (this.finishOrder.length === this.racers.length) {
      this.end(ev);
      return;
    }
    // A racer still out on course long after the leader is a DNF: without this
    // a stuck opponent would hold the results screen open indefinitely.
    if (this.leaderFinishTime >= 0
        && this.time - this.leaderFinishTime > RACE.dnfGraceSeconds) {
      this.end(ev);
      return;
    }
    if (this.tick > RACE.maxTicks) this.end(ev);
  }

  /**
   * Closes the race, placing anyone still running behind every finisher.
   * Public because a caller that stops the race on its own budget - the headless
   * runner, or a player quitting - still needs a complete result set.
   */
  end(ev) {
    if (this.phase === PHASE.FINISHED) return;
    // Anyone still running is placed behind every finisher, by progress.
    const stragglers = this.racers
      .filter((r) => !r.finished)
      .sort((a, b) => b.progress - a.progress);
    for (const r of stragglers) {
      r.placement = this.finishOrder.length + 1;
      r.dnf = true;
      this.finishOrder.push(r.index);
    }
    this.phase = PHASE.FINISHED;
    ev.push(EV.RACE_END, this.player.index, this.player.placement);
  }

  /** Signed gap in metres from the player to the racer ranked `rank`. */
  gapTo(rank) {
    const other = this.racers[this.order[rank]];
    if (!other) return 0;
    return other.pos.z - this.player.pos.z;
  }

  get playerRank() {
    return this.order.indexOf(this.player.index) + 1;
  }

  get leader() {
    return this.racers[this.order[0]];
  }

  results() {
    return this.finishOrder.map((idx, i) => {
      const r = this.racers[idx];
      return {
        index: idx,
        name: r.name,
        placement: i + 1,
        time: r.finished ? r.finishTime : null,
        dnf: !!r.dnf,
        coins: r.coins,
        deaths: r.deaths,
        isPlayer: r.isPlayer,
      };
    });
  }
}
