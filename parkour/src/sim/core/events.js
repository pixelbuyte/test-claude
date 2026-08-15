/**
 * The bridge between the simulation and everything that watches it.
 *
 * The sim never calls a renderer, plays a sound, or touches the DOM. It pushes
 * flat records into this preallocated ring; the render, audio and UI layers
 * drain it once per rendered frame. That separation is what lets a full race
 * field be simulated headlessly in Node with no browser at all.
 */

export const EV = {
  // Movement / parkour
  JUMP: 1,
  DOUBLE_JUMP: 2,
  LAND: 3,
  SLIDE_START: 4,
  SLIDE_END: 5,
  VAULT: 6,
  WALLRUN_START: 7,
  WALLRUN_END: 8,
  WALL_JUMP: 9,
  LEDGE_GRAB: 10,
  MANTLE: 11,
  RAIL_ENTER: 12,
  RAIL_EXIT: 13,
  LAUNCH_PAD: 14,
  FOOTSTEP: 15,
  STUMBLE: 16,
  CRASH: 17,
  DEATH: 18,
  RESPAWN: 19,
  BOOST_PAD: 20,

  // Pickups
  COIN: 30,
  SHARD: 31,
  POWERUP_PICKUP: 32,
  POWERUP_EXPIRE: 33,
  SHIELD_ABSORB: 34,
  COMBO_UP: 35,
  COMBO_RESET: 36,

  // Race
  COUNTDOWN_TICK: 50,
  RACE_START: 51,
  CHECKPOINT: 52,
  RANK_CHANGE: 53,
  FINISH: 54,
  RACE_END: 55,
  LAP_PROGRESS: 56,

  // Obstacles
  BARRIER_BREAK: 60,
  PLATFORM_FALL: 61,
};

/** Human-readable names. Used by tests and the debug overlay only. */
export const EV_NAME = (() => {
  const out = Object.create(null);
  for (const key of Object.keys(EV)) out[EV[key]] = key;
  return out;
})();

/**
 * Fixed-capacity ring of flat event records.
 *
 * Records are preallocated and reused; `push` never allocates. If more than
 * `capacity` events accumulate before a drain, the oldest are overwritten and
 * `dropped` counts them - tests assert that counter stays at zero.
 */
export class EventQueue {
  constructor(capacity = 256) {
    this.capacity = capacity;
    this.items = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.items[i] = { type: 0, actor: 0, a: 0, b: 0, c: 0 };
    }
    this.head = 0;
    this.count = 0;
    this.dropped = 0;
  }

  /**
   * @param {number} type   one of EV.*
   * @param {number} actor  racer index (0 = player)
   * @param {number} a,b,c  event-specific payload
   */
  push(type, actor = 0, a = 0, b = 0, c = 0) {
    if (this.count === this.capacity) {
      // Overwrite the oldest rather than grow - a fixed budget is the point.
      this.dropped++;
      this.head = (this.head + 1) % this.capacity;
      this.count--;
    }
    const idx = (this.head + this.count) % this.capacity;
    const it = this.items[idx];
    it.type = type;
    it.actor = actor;
    it.a = a;
    it.b = b;
    it.c = c;
    this.count++;
  }

  /**
   * Calls `fn(record)` for each pending event, oldest first, then empties the
   * queue. The record is reused after the callback returns - copy anything you
   * need to keep.
   */
  drain(fn) {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      fn(this.items[(this.head + i) % this.capacity]);
    }
    this.head = 0;
    this.count = 0;
  }

  /** Number of pending events matching `type` - test helper. */
  countOf(type) {
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.items[(this.head + i) % this.capacity].type === type) n++;
    }
    return n;
  }

  clear() {
    this.head = 0;
    this.count = 0;
    this.dropped = 0;
  }
}
