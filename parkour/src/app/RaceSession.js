/**
 * One run of one level.
 *
 * The seam between simulation and view. It owns the race on the sim side and the
 * scene on the view side, and it is the only place the two are allowed to meet.
 *
 * The loop is fixed-step with interpolated rendering: `update(dt)` runs whole
 * STEP-sized substeps and `render()` draws between the last two. That is what
 * keeps physics identical on a 60 Hz phone and a 144 Hz desktop.
 */
import { STEP, CAMERA, QUALITY } from '../config.js';
import { World } from '../sim/world/World.js';
import { EventQueue, EV } from '../sim/core/events.js';
import { createStepper, advance } from '../sim/core/fixedloop.js';
import { makeRacer, placeRacer, makeIntent } from '../sim/player/PlayerController.js';
import { RaceManager, PHASE } from '../sim/race/RaceManager.js';
import { makeCamera, stepCamera, resetCamera, addShake, setAspectMode } from '../sim/camera/CameraController.js';
import { activeEffects } from '../sim/systems/PowerUpSystem.js';
import { SceneBuilder } from '../render/SceneBuilder.js';
import { VFXManager } from '../render/VFXManager.js';
import { CharacterView } from '../render/character/CharacterView.js';

/** Opponent palette - distinct enough to tell apart at speed. */
const OPPONENT_COLORS = [0x4fc3f7, 0xba68c8, 0x81c784, 0xffd54f, 0xff8a65, 0x90a4ae];

export class RaceSession {
  /**
   * @param {object} level     assembled level data
   * @param {Renderer} renderer
   * @param {InputManager} input
   * @param {object} opts      { roster, seed, tier }
   */
  constructor(level, renderer, input, opts = {}) {
    this.level = level;
    this.renderer = renderer;
    this.input = input;
    this.tier = opts.tier || 'medium';

    this.world = new World(level);
    this.events = new EventQueue(1024);
    this.stepper = createStepper();
    this.running = false;

    const player = makeRacer(0, { isPlayer: true, name: 'You' });
    this.race = new RaceManager(this.world, player, opts.roster || [], {
      seed: opts.seed ?? 1,
    });
    this.player = player;

    this.camera = makeCamera();

    this.scene = new SceneBuilder(level);
    renderer.applyTheme(level.theme);
    renderer.scene.add(this.scene.group);

    this.vfx = new VFXManager(renderer.scene, this.tier);
    // Reduced motion keeps the game readable but drops the flourish. The saved
    // setting wins over the OS hint, because it is the more specific choice.
    const reduced = opts.reducedMotion ?? prefersReducedMotion();
    if (reduced) this.vfx.setEnabled(false);
    this.camera.allowShake = !reduced;
    this.audio = opts.audio || null;

    // One view per racer. Interpolation endpoints live alongside, so rendering
    // never reads a half-stepped body.
    const me = opts.character;
    this.views = this.race.racers.map((r, i) => {
      const view = new CharacterView(r.isPlayer && me ? {
        color: me.primary, accent: me.accent, skin: me.skin,
      } : {
        color: r.isPlayer ? 0xff7a3d : OPPONENT_COLORS[(i - 1) % OPPONENT_COLORS.length],
        accent: r.isPlayer ? 0x2b3350 : 0x1e2438,
      });
      renderer.scene.add(view.root);
      return {
        view,
        racer: r,
        prev: { x: r.pos.x, y: r.pos.y, z: r.pos.z },
        curr: { x: r.pos.x, y: r.pos.y, z: r.pos.z },
        render: { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, state: 0, grounded: false, speed: 0 },
      };
    });

    this.intent = input ? input.intent : makeIntent();
    this.onEvent = null;

    resetCamera(this.camera, player);
    this._syncAspect();
  }

  start() {
    this.running = true;
  }

  pause() {
    this.running = false;
    if (this.input) this.input.reset();
  }

  resume() {
    this.running = true;
    this.stepper.accumulator = 0;
  }

  get phase() { return this.race.phase; }
  get elapsed() { return this.race.time; }
  get tick() { return this.race.tick; }
  get countdown() { return this.race.countdown; }
  get finished() { return this.race.phase === PHASE.FINISHED; }

  /**
   * Advances the simulation by a wall-clock delta.
   * @returns the number of substeps actually run.
   */
  update(dtSeconds) {
    if (!this.running) return 0;

    const intent = this.input ? this.input.update() : this.intent;
    const steps = advance(this.stepper, dtSeconds);

    for (let s = 0; s < steps; s++) {
      for (const v of this.views) {
        v.prev.x = v.racer.pos.x;
        v.prev.y = v.racer.pos.y;
        v.prev.z = v.racer.pos.z;
      }

      this.race.step(intent, this.events);
      stepCamera(this.camera, this.player, this.world);
      this._drainEvents();

      for (const v of this.views) {
        v.curr.x = v.racer.pos.x;
        v.curr.y = v.racer.pos.y;
        v.curr.z = v.racer.pos.z;
      }
    }

    return steps;
  }

  /**
   * Reacts to what the simulation reported. The race rules were already applied
   * inside `race.step`; everything here is presentation.
   */
  _drainEvents() {
    this.events.drain((e) => {
      if (this.audio) this.audio.handle(e, this.player.index);
      this._spawnVFX(e);
      if (e.actor === this.player.index) {
        switch (e.type) {
          case EV.BOOST_PAD: addShake(this.camera, CAMERA.shakeBoost); break;
          case EV.LAND:
            if (e.a > 12) addShake(this.camera, CAMERA.shakeLand * Math.min(1, e.a / 24));
            break;
          case EV.CRASH: addShake(this.camera, CAMERA.shakeCrash); break;
          case EV.DEATH: addShake(this.camera, CAMERA.shakeCrash); break;
          case EV.RESPAWN: resetCamera(this.camera, this.player); break;
          default: break;
        }
      }
      if (this.onEvent) this.onEvent(e);
    });
  }

  /**
   * Turns an event into particles. Every racer gets these, not just the player -
   * seeing an opponent crash ahead of you is information.
   */
  _spawnVFX(e) {
    const racer = this.race.racers[e.actor];
    if (!racer || !this.vfx.enabled) return;
    const at = racer.pos;

    switch (e.type) {
      case EV.LAND:
        this.vfx.emit('land', at, { scale: Math.min(1.6, 0.5 + (e.a || 0) / 20) });
        break;
      case EV.JUMP:
      case EV.DOUBLE_JUMP:
        this.vfx.emit('dust', at, { scale: 0.8 });
        break;
      case EV.SLIDE_START:
        this.vfx.emit('spark', at, { scale: 0.9, dirZ: -0.6 });
        break;
      case EV.VAULT:
        this.vfx.emit('dust', at, { scale: 1.2 });
        break;
      case EV.WALLRUN_START:
      case EV.WALL_JUMP:
        this.vfx.emit('wall', at, { scale: 1.2, dirX: racer.wallSide > 0 ? -0.8 : 0.8 });
        break;
      case EV.LAUNCH_PAD:
      case EV.BOOST_PAD:
        this.vfx.emit('boost', at, { scale: 1.3, dirY: 0.8 });
        break;
      case EV.COIN:
        this.vfx.emit('coin', at, { scale: 0.7 });
        break;
      case EV.SHARD:
        this.vfx.emit('shard', at, { scale: 1.1 });
        break;
      case EV.POWERUP_PICKUP:
        this.vfx.emit('power', at, { scale: 1.2 });
        break;
      case EV.SHIELD_ABSORB:
        this.vfx.emit('boost', at, { scale: 1.5 });
        break;
      case EV.CRASH:
        this.vfx.emit('crash', at, { scale: 1.1, dirZ: -0.7 });
        break;
      case EV.DEATH:
        this.vfx.emit('crash', at, { scale: 1.8 });
        break;
      default:
        break;
    }
  }

  /**
   * Draws the current state.
   * @param {number} dtSeconds real time since the last frame, for animation only
   */
  render(dtSeconds) {
    const alpha = this.stepper.alpha;
    const me = this.views[0];
    const maxOpponents = QUALITY[this.tier].maxOpponentsRendered;

    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i];
      const r = v.render;
      r.pos.x = v.prev.x + (v.curr.x - v.prev.x) * alpha;
      r.pos.y = v.prev.y + (v.curr.y - v.prev.y) * alpha;
      r.pos.z = v.prev.z + (v.curr.z - v.prev.z) * alpha;
      r.vel.x = v.racer.vel.x;
      r.vel.y = v.racer.vel.y;
      r.vel.z = v.racer.vel.z;
      r.state = v.racer.state;
      r.grounded = v.racer.grounded;
      r.speed = v.racer.speed;

      // Opponents far away, behind, or beyond the tier's budget are simply not
      // drawn. Culling them is the single biggest draw-call saving available.
      if (i > 0) {
        const dz = r.pos.z - me.render.pos.z;
        const visible = i <= maxOpponents && dz > -30 && dz < 90;
        v.view.root.visible = visible;
        if (!visible) continue;
      }

      v.view.pose(r, dtSeconds);
    }

    const focus = me.render.pos;
    this.renderer.syncCamera(this.camera);
    this.renderer.followSun(focus.x, focus.y, focus.z);

    this.scene.stream(focus.z);
    this.scene.updateMovers();
    this.scene.updatePickups(this.world, this.race.time);

    this.vfx.speedLines(focus, this.player.speed, dtSeconds);
    this.vfx.update(dtSeconds);
    // The player's rig emitted these while posing; footsteps land on the frame
    // the foot planted rather than on a timer's best guess.
    if (this.audio) this.audio.playAnimationEvents(me.view.events, this.player);

    this.renderer.render();
  }

  /** Everything the HUD needs, gathered once per frame. */
  hudState() {
    const p = this.player;
    return {
      time: this.race.time,
      rank: this.race.playerRank,
      fieldSize: this.race.racers.length,
      coins: p.coins,
      speed: p.speed,
      progress: this.world.progressOf(p.pos.z),
      state: p.state,
      phase: this.race.phase,
      countdown: this.race.countdown,
      finished: p.finished,
      deaths: p.deaths,
      shards: p.shards,
      effects: activeEffects(p),
    };
  }

  results() {
    return this.race.results();
  }

  /**
   * Applies a quality tier to the live race.
   *
   * The renderer handles its own side; what belongs to the session is the
   * particle budget and how many opponents are worth drawing. Both take effect
   * on the very next frame, which matters: the point of an adaptive downgrade is
   * to relieve pressure now, not at the next race.
   */
  setTier(tier) {
    const q = QUALITY[tier];
    if (!q || tier === this.tier) return false;
    this.tier = tier;
    this.vfx.setBudget(q.particleBudget);
    return true;
  }

  /** Applies the reduced-motion setting without rebuilding the race. */
  setReducedMotion(on) {
    this.vfx.setEnabled(!on);
    this.camera.allowShake = !on;
  }

  onResize() {
    this._syncAspect();
  }

  _syncAspect() {
    setAspectMode(this.camera, this.renderer.width || 1, this.renderer.height || 1);
  }

  dispose() {
    this.renderer.scene.remove(this.scene.group);
    for (const v of this.views) {
      this.renderer.scene.remove(v.view.root);
      v.view.dispose();
    }
    this.scene.dispose();
  }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { PHASE };
