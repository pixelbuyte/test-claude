/**
 * Every particle in the game, in one draw call.
 *
 * A single THREE.Points with a preallocated interleaved buffer. Dust, sparks,
 * pickup pops, crash debris and speed lines are all presets emitting into the
 * same pool - so adding an effect costs a table entry rather than a draw call,
 * and the particle budget is a hard number rather than a hope.
 *
 * Nothing is allocated after construction. Emitting overwrites the oldest slot
 * when the pool is full, which is the right failure mode: the newest effect is
 * the one the player is looking at.
 */
import * as THREE from '../../vendor/three/three.module.min.js';
import { QUALITY } from '../config.js';

/** Preset id → behaviour. Tuned by feel, then left alone. */
const PRESETS = {
  dust: { count: 5, life: 0.5, size: 0.16, speed: 1.6, gravity: -2, spread: 0.5, color: 0xcfd8ee, drag: 3 },
  land: { count: 10, life: 0.45, size: 0.2, speed: 3.0, gravity: -7, spread: 0.9, color: 0xdfe6f5, drag: 3.4 },
  spark: { count: 14, life: 0.5, size: 0.13, speed: 6.5, gravity: -14, spread: 1.4, color: 0xffb26b, drag: 1.6 },
  crash: { count: 22, life: 0.7, size: 0.19, speed: 7.5, gravity: -16, spread: 2.0, color: 0xff5a4a, drag: 1.4 },
  coin: { count: 8, life: 0.42, size: 0.15, speed: 3.4, gravity: -3, spread: 1.1, color: 0xffd85e, drag: 2.4 },
  shard: { count: 16, life: 0.6, size: 0.17, speed: 4.4, gravity: -3, spread: 1.3, color: 0x8fe6ff, drag: 2.0 },
  power: { count: 20, life: 0.65, size: 0.18, speed: 4.8, gravity: -1.5, spread: 1.6, color: 0x9d7bff, drag: 2.0 },
  boost: { count: 16, life: 0.5, size: 0.16, speed: 5.5, gravity: -1, spread: 1.2, color: 0x6fd0ff, drag: 2.2 },
  wall: { count: 6, life: 0.4, size: 0.13, speed: 2.6, gravity: -5, spread: 0.7, color: 0xbcc6dd, drag: 2.8 },
  speedline: { count: 3, life: 0.28, size: 0.1, speed: 0.4, gravity: 0, spread: 3.2, color: 0xffffff, drag: 0.2 },
};

/**
 * A soft round particle, drawn once into a canvas.
 *
 * 64px is plenty: these are never more than a few dozen pixels on screen, and a
 * radial falloff is the whole difference between "spark" and "square".
 */
function makeSpriteTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class VFXManager {
  /**
   * @param {THREE.Scene} scene
   * @param {string} tier  quality tier; sets the particle budget
   */
  constructor(scene, tier = 'medium') {
    this.budget = QUALITY[tier]?.particleBudget ?? 900;
    /**
     * How many slots were actually allocated. The pool is sized once and never
     * resized, so an adaptive downgrade can lower `budget` to do less work while
     * a later upgrade can only ever climb back to what was reserved here.
     */
    this.capacity = this.budget;
    this.enabled = true;

    const n = this.budget;
    this.positions = new Float32Array(n * 3);
    this.velocities = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    /** The colour a particle was emitted with; `colors` is that times its fade. */
    this.baseColors = new Float32Array(n * 3);
    this.sizes = new Float32Array(n);
    this.baseSizes = new Float32Array(n);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.gravity = new Float32Array(n);

    this.head = 0;
    this.alive = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    // Never culled: the bounding sphere would have to be recomputed every frame,
    // and the particles are always near the camera anyway.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const mat = new THREE.PointsMaterial({
      size: 0.18,
      // Without a map every particle is a hard-edged square, which is why a
      // crash read as confetti rather than debris. The sprite is drawn onto a
      // canvas at construction - still no asset file, still fully procedural.
      map: makeSpriteTexture(),
      alphaTest: 0.01,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = 'vfx';
    scene.add(this.points);

    this.geometry = geo;
    this.material = mat;
    this._color = new THREE.Color();
    // Deterministic scatter, so a replay looks the same. No Math.random here
    // for the same reason the simulation has none.
    this._seed = 1337;
  }

  _rand() {
    this._seed = (this._seed * 1664525 + 1013904223) >>> 0;
    return this._seed / 4294967296;
  }

  /**
   * Emits a burst.
   *
   * @param {string} preset  key into PRESETS
   * @param {object} at      { x, y, z }
   * @param {object} [opts]  { scale, color, dirX, dirY, dirZ }
   */
  emit(preset, at, opts = {}) {
    if (!this.enabled) return;
    const p = PRESETS[preset];
    if (!p) return;

    const scale = opts.scale ?? 1;
    const count = Math.max(1, Math.round(p.count * scale));
    this._color.setHex(opts.color ?? p.color);

    for (let i = 0; i < count; i++) {
      const slot = this.head;
      this.head = (this.head + 1) % this.budget;
      if (this.life[slot] <= 0) this.alive++;

      const o = slot * 3;
      this.positions[o] = at.x + (this._rand() - 0.5) * p.spread * 0.35;
      this.positions[o + 1] = at.y + (this._rand() - 0.5) * p.spread * 0.35 + 0.3;
      this.positions[o + 2] = at.z + (this._rand() - 0.5) * p.spread * 0.35;

      const sp = p.speed * (0.45 + this._rand() * 0.75) * scale;
      this.velocities[o] = ((this._rand() - 0.5) * p.spread + (opts.dirX ?? 0)) * sp;
      this.velocities[o + 1] = (this._rand() * 0.8 + 0.2 + (opts.dirY ?? 0)) * sp;
      this.velocities[o + 2] = ((this._rand() - 0.5) * p.spread + (opts.dirZ ?? 0)) * sp;

      this.baseColors[o] = this._color.r;
      this.baseColors[o + 1] = this._color.g;
      this.baseColors[o + 2] = this._color.b;
      this.colors[o] = this._color.r;
      this.colors[o + 1] = this._color.g;
      this.colors[o + 2] = this._color.b;

      this.baseSizes[slot] = p.size * (0.7 + this._rand() * 0.6);
      this.sizes[slot] = this.baseSizes[slot];
      this.maxLife[slot] = p.life * (0.75 + this._rand() * 0.5);
      this.life[slot] = this.maxLife[slot];
      this.drag[slot] = p.drag;
      this.gravity[slot] = p.gravity;
    }
  }

  /**
   * A trail behind a fast runner. Emitted continuously rather than as a burst,
   * so it is rate-limited by the caller's dt.
   */
  speedLines(at, speed, dt) {
    if (!this.enabled || speed < 15) return;
    this._speedAccum = (this._speedAccum || 0) + dt * (speed - 14) * 2.5;
    while (this._speedAccum >= 1) {
      this._speedAccum -= 1;
      this.emit('speedline', {
        x: at.x + (this._rand() - 0.5) * 6,
        y: at.y + this._rand() * 3,
        z: at.z + 6 + this._rand() * 10,
      }, { scale: 1 });
    }
  }

  /** Integrates every live particle. One flat loop, no allocation. */
  update(dt) {
    if (this.alive === 0) return;
    const pos = this.positions;
    const vel = this.velocities;
    const col = this.colors;

    let alive = 0;
    for (let i = 0; i < this.budget; i++) {
      const life = this.life[i];
      if (life <= 0) continue;

      const next = life - dt;
      const o = i * 3;

      if (next <= 0) {
        this.life[i] = 0;
        // Park dead particles far away rather than resizing anything.
        pos[o + 1] = -9999;
        continue;
      }

      this.life[i] = next;
      alive++;

      const d = 1 - Math.min(1, this.drag[i] * dt);
      vel[o] *= d;
      vel[o + 1] = vel[o + 1] * d + this.gravity[i] * dt;
      vel[o + 2] *= d;

      pos[o] += vel[o] * dt;
      pos[o + 1] += vel[o + 1] * dt;
      pos[o + 2] += vel[o + 2] * dt;

      // Fade by scaling the emitted colour toward black. Under additive
      // blending that *is* a fade-out, and it costs no per-particle opacity
      // attribute. Scaling from the stored base each frame rather than
      // multiplying in place keeps it framerate-independent and reversible.
      const t = next / this.maxLife[i];
      const fade = t * t;
      col[o] = this.baseColors[o] * fade;
      col[o + 1] = this.baseColors[o + 1] * fade;
      col[o + 2] = this.baseColors[o + 2] * fade;
      this.sizes[i] = this.baseSizes[i] * (0.55 + t * 0.45);
    }

    this.alive = alive;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  setEnabled(on) {
    this.enabled = on;
    this.points.visible = on;
    if (!on) this.clear();
  }

  /**
   * Narrows (or restores) the working budget without reallocating.
   *
   * Everything alive is cleared first: shrinking the budget makes the slots
   * above it unreachable, and a particle stranded there would never be
   * integrated again and so would hang in the air for the rest of the race.
   */
  setBudget(n) {
    const next = Math.max(1, Math.min(this.capacity, Math.floor(n)));
    if (next === this.budget) return this.budget;
    this.clear();
    this.budget = next;
    this.head = 0;
    return this.budget;
  }

  clear() {
    this.life.fill(0);
    // Bounded by capacity, not budget: after a downgrade the stranded slots
    // above the budget still have to be parked out of sight.
    for (let i = 0; i < this.capacity; i++) this.positions[i * 3 + 1] = -9999;
    this.alive = 0;
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    if (this.material.map) this.material.map.dispose();
    this.material.dispose();
  }
}

export { PRESETS };
