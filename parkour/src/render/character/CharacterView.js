/**
 * The runner's body.
 *
 * A hierarchy of plain Groups with one primitive per bone - no SkinnedMesh, no
 * weights, no model files. Every character shares this rig, so every animation
 * clip applies to all of them, and an opponent past the LOD distance can drop to
 * a two-box impostor without any special-casing.
 *
 * This is the Phase 2 stand-in: the bones exist and are posed procedurally from
 * simulation state. The keyframed clip system replaces `pose()` later without
 * changing the rig or anything that holds a reference to it.
 */
import * as THREE from 'three';
import { BODY } from '../../config.js';
import { STATE } from '../../sim/player/states.js';

const SKIN = 0xf0c8a0;

function box(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(geo, mat);
}

export class CharacterView {
  /**
   * @param {object} opts  { color, accent } from the character definition
   */
  constructor(opts = {}) {
    const color = opts.color ?? 0xff7a3d;
    const accent = opts.accent ?? 0x2b3350;

    this.root = new THREE.Group();

    // Everything hangs off a hips group so a slide or a landing crouch is one
    // transform rather than a per-part adjustment.
    this.hips = new THREE.Group();
    this.hips.position.y = 0.92;
    this.root.add(this.hips);

    this.torso = box(0.42, 0.62, 0.26, color);
    this.torso.position.y = 0.3;
    this.hips.add(this.torso);

    this.head = box(0.26, 0.26, 0.26, SKIN);
    this.head.position.y = 0.78;
    this.hips.add(this.head);

    this.armL = box(0.13, 0.5, 0.13, accent);
    this.armL.position.set(-0.29, 0.34, 0);
    this.hips.add(this.armL);

    this.armR = box(0.13, 0.5, 0.13, accent);
    this.armR.position.set(0.29, 0.34, 0);
    this.hips.add(this.armR);

    this.legL = box(0.16, 0.6, 0.16, accent);
    this.legL.position.set(-0.12, -0.32, 0);
    this.hips.add(this.legL);

    this.legR = box(0.16, 0.6, 0.16, accent);
    this.legR.position.set(0.12, -0.32, 0);
    this.hips.add(this.legR);

    this.phase = 0;
  }

  /**
   * Poses the rig from simulation state.
   *
   * @param {object} p     the racer
   * @param {number} dt    seconds since the last rendered frame
   */
  pose(p, dt) {
    const root = this.root;
    root.position.set(p.pos.x, p.pos.y, p.pos.z);

    // Lean into lateral movement, and pitch forward with speed.
    const lean = THREE.MathUtils.clamp(-p.vel.x * 0.035, -0.35, 0.35);
    root.rotation.z = lean;
    root.rotation.y = THREE.MathUtils.clamp(-p.vel.x * 0.02, -0.25, 0.25);

    const airborne = !p.grounded;
    const crouched = p.state === STATE.SLIDE;

    // Stride rate follows actual speed, so footfalls line up with the ground at
    // any pace - the same phase will drive footstep audio.
    this.phase += dt * (2.2 + p.speed * 0.55);
    const swing = Math.sin(this.phase);
    const swing2 = Math.sin(this.phase + Math.PI);

    if (crouched) {
      this.hips.position.y = 0.42;
      this.hips.rotation.x = 0.9;
      this.legL.rotation.x = -0.9;
      this.legR.rotation.x = -0.5;
      this.armL.rotation.x = -1.2;
      this.armR.rotation.x = 0.4;
    } else if (airborne) {
      this.hips.position.y = 0.92;
      this.hips.rotation.x = p.vel.y > 0 ? -0.12 : 0.16;
      const tuck = p.state === STATE.VAULT || p.state === STATE.MANTLE ? 1.1 : 0.5;
      this.legL.rotation.x = -tuck;
      this.legR.rotation.x = -tuck * 0.5;
      this.armL.rotation.x = p.state === STATE.WALLRUN ? -1.6 : -2.2;
      this.armR.rotation.x = -1.0;
    } else {
      this.hips.position.y = 0.92 - Math.abs(swing) * 0.05;
      this.hips.rotation.x = 0.08 + THREE.MathUtils.clamp(p.speed * 0.006, 0, 0.12);
      this.legL.rotation.x = swing * 0.85;
      this.legR.rotation.x = swing2 * 0.85;
      this.armL.rotation.x = swing2 * 0.7;
      this.armR.rotation.x = swing * 0.7;
    }

    this.head.rotation.x = -this.hips.rotation.x * 0.6;
  }

  /** Height of the visual body - used to place nameplates and the camera anchor. */
  get height() {
    return BODY.height;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
