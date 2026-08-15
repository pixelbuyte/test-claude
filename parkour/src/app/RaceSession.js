/**
 * One run of one level.
 *
 * The seam between simulation and view. It owns the world, the racer and the
 * camera on the sim side; the scene and character on the view side; and it is
 * the only place the two are allowed to meet.
 *
 * The loop is fixed-step with interpolated rendering: `update(dt)` runs whole
 * STEP-sized substeps and `render(alpha)` draws between the last two. That is
 * what keeps physics identical on a 60 Hz phone and a 144 Hz desktop.
 */
import { STEP, CAMERA } from '../config.js';
import { World } from '../sim/world/World.js';
import { EventQueue, EV } from '../sim/core/events.js';
import { createStepper, advance } from '../sim/core/fixedloop.js';
import {
  makeRacer, placeRacer, stepRacer, consumeEdges, saveCheckpoint, applyBoost,
} from '../sim/player/PlayerController.js';
import { makeCamera, stepCamera, resetCamera, addShake, setAspectMode } from '../sim/camera/CameraController.js';
import { SceneBuilder } from '../render/SceneBuilder.js';
import { CharacterView } from '../render/character/CharacterView.js';

export class RaceSession {
  /**
   * @param {object} level     assembled level data
   * @param {Renderer} renderer
   * @param {InputManager} input
   */
  constructor(level, renderer, input) {
    this.level = level;
    this.renderer = renderer;
    this.input = input;

    this.world = new World(level);
    this.events = new EventQueue(512);
    this.stepper = createStepper();
    this.tick = 0;
    this.elapsed = 0;
    this.running = false;

    this.player = makeRacer(0, { isPlayer: true, name: 'You' });
    placeRacer(this.player, 0, 0, level.startZ + 2);
    this.player.speed = 0;

    this.camera = makeCamera();
    this.camera.allowShake = !prefersReducedMotion();

    this.scene = new SceneBuilder(level);
    renderer.applyTheme(level.theme);
    renderer.scene.add(this.scene.group);

    this.character = new CharacterView({ color: 0xff7a3d, accent: 0x2b3350 });
    renderer.scene.add(this.character.root);

    // Interpolation endpoints, so rendering never reads a half-stepped body.
    this._prev = { x: 0, y: 0, z: 0 };
    this._curr = { x: 0, y: 0, z: 0 };
    this._render = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } };

    this.stats = { coins: 0, crashes: 0, deaths: 0, finished: false, time: 0 };
    this.onEvent = null;

    resetCamera(this.camera, this.player);
    this._syncAspect();
  }

  start() {
    this.running = true;
    this.elapsed = 0;
  }

  pause() {
    this.running = false;
    this.input.reset();
  }

  resume() {
    this.running = true;
  }

  /**
   * Advances the simulation by a wall-clock delta.
   * @returns the number of substeps actually run.
   */
  update(dtSeconds) {
    if (!this.running) return 0;

    const intent = this.input.update();
    const steps = advance(this.stepper, dtSeconds);

    for (let s = 0; s < steps; s++) {
      this._prev.x = this.player.pos.x;
      this._prev.y = this.player.pos.y;
      this._prev.z = this.player.pos.z;

      this.world.updateMovers(this.tick);
      stepRacer(this.player, intent, this.world, this.events);
      stepCamera(this.camera, this.player, this.world);

      // Edges belong to the first substep of a frame only, or one tap fires
      // twice whenever the accumulator runs two substeps.
      consumeEdges(intent);

      this._drainEvents();
      this.tick++;
      this.elapsed += STEP;

      this._curr.x = this.player.pos.x;
      this._curr.y = this.player.pos.y;
      this._curr.z = this.player.pos.z;
    }

    this.stats.time = this.elapsed;
    return steps;
  }

  _drainEvents() {
    const p = this.player;
    this.events.drain((e) => {
      switch (e.type) {
        case EV.CHECKPOINT: {
          const cp = this.world.checkpoints[e.a];
          if (cp) saveCheckpoint(p, cp.index, cp.x, cp.y, cp.z);
          break;
        }
        case EV.COIN:
          p.coins += e.c || 1;
          this.stats.coins += e.c || 1;
          break;
        case EV.BOOST_PAD:
          applyBoost(p);
          addShake(this.camera, CAMERA.shakeBoost);
          break;
        case EV.LAND:
          if (e.a > 12) addShake(this.camera, CAMERA.shakeLand * Math.min(1, e.a / 24));
          break;
        case EV.CRASH:
          this.stats.crashes++;
          addShake(this.camera, CAMERA.shakeCrash);
          break;
        case EV.DEATH:
          this.stats.deaths++;
          addShake(this.camera, CAMERA.shakeCrash);
          break;
        case EV.RESPAWN:
          resetCamera(this.camera, p);
          break;
        case EV.FINISH:
          this.stats.finished = true;
          p.finished = true;
          p.finishTime = this.elapsed;
          break;
        default:
          break;
      }
      if (this.onEvent) this.onEvent(e);
    });
  }

  /**
   * Draws the current state.
   * @param {number} dtSeconds real time since the last frame, for animation only
   */
  render(dtSeconds) {
    const alpha = this.stepper.alpha;
    const r = this._render;

    // Interpolate the body between the last two simulation states.
    r.pos.x = this._prev.x + (this._curr.x - this._prev.x) * alpha;
    r.pos.y = this._prev.y + (this._curr.y - this._prev.y) * alpha;
    r.pos.z = this._prev.z + (this._curr.z - this._prev.z) * alpha;
    r.vel.x = this.player.vel.x;
    r.vel.y = this.player.vel.y;
    r.vel.z = this.player.vel.z;
    r.state = this.player.state;
    r.grounded = this.player.grounded;
    r.speed = this.player.speed;

    this.character.pose(r, dtSeconds);
    this.renderer.syncCamera(this.camera);
    this.renderer.followSun(r.pos.x, r.pos.y, r.pos.z);

    this.scene.stream(r.pos.z);
    this.scene.updateMovers();
    this.scene.updatePickups(this.world, this.elapsed);

    this.renderer.render();
  }

  onResize() {
    this._syncAspect();
  }

  _syncAspect() {
    setAspectMode(this.camera, this.renderer.width || 1, this.renderer.height || 1);
  }

  dispose() {
    this.renderer.scene.remove(this.scene.group);
    this.renderer.scene.remove(this.character.root);
    this.scene.dispose();
    this.character.dispose();
  }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
