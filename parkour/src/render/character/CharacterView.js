/**
 * The runner's body.
 *
 * Builds the 15-bone hierarchy from `data/anim/rig.js` as plain Groups - no
 * SkinnedMesh, no weights, no model file - and applies the flat Euler pose the
 * animation controller produces.
 *
 * This file does no animation reasoning of its own. It builds bones and copies
 * angles; deciding what those angles should be is `sim/anim`'s job, which is why
 * the blend tree can be tested without a browser.
 */
import * as THREE from '../../../vendor/three/three.module.min.js';
import { BODY } from '../../config.js';
import { BONES, BONE, BONE_COUNT } from '../../data/anim/rig.js';
import { makeAnimator, stepAnimator } from '../../sim/anim/AnimationController.js';

const SKIN = 0xf0c8a0;

/**
 * Height of the rotation pivot above the feet, in metres - roughly the hips.
 * The whole body turns about this point.
 */
const PIVOT_Y = 0.95;

/**
 * Low segment counts on purpose. These are read at three to thirty metres on a
 * phone, where the difference between eight radial segments and sixteen is
 * invisible and the difference in triangle count is not.
 */
const RADIAL = 8;
const CAP_SEGS = 3;

/**
 * Concatenates geometries into one non-indexed buffer.
 *
 * three's mergeGeometries lives in the addons, which are not vendored. This is
 * the twenty lines of it that this file needs, and it exists so a hand can be
 * merged into the forearm it belongs to: one mesh per bone, not two, because a
 * six-racer field is already close to the draw-call budget.
 */
function mergeInto(geometries) {
  const parts = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;

  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    position.set(g.attributes.position.array, o);
    normal.set(g.attributes.normal.array, o);
    o += g.attributes.position.count * 3;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.computeBoundingSphere();
  // Both the sources and the non-indexed copies: `toNonIndexed` returns a new
  // geometry and leaves the original alone.
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== geometries[i]) geometries[i].dispose();
    parts[i].dispose();
  }
  return out;
}

/**
 * One bone's geometry, anchored so it hangs down from its joint.
 *
 * Hanging from the joint rather than centring on it is what makes rotating a
 * joint swing the limb instead of spinning it about its own middle - the same
 * reason the box version translated by -height/2.
 */
function boneGeometry(def) {
  const [w, h, d] = def.size;
  const shape = def.shape || 'capsule';
  const pieces = [];

  if (shape === 'sphere') {
    const geo = new THREE.SphereGeometry(w / 2, RADIAL * 2, RADIAL);
    // Scaled rather than re-tessellated, so a head can be wider than it is tall
    // without a second geometry type.
    geo.scale(1, h / w, d / w);
    geo.translate(0, -h / 2, 0);
    pieces.push(geo);
  } else if (shape === 'box') {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, -h / 2, 0);
    pieces.push(geo);
  } else {
    // CapsuleGeometry's `length` excludes the two hemispherical caps, so the
    // cylinder has to be shortened by a full diameter for total height to come
    // out as `h`. Getting this wrong makes every limb longer than its bone and
    // the whole skeleton drifts apart at the joints.
    const radius = Math.min(w, d) / 2;
    const length = Math.max(0.001, h - radius * 2);
    const geo = new THREE.CapsuleGeometry(radius, length, CAP_SEGS, RADIAL);
    geo.translate(0, -h / 2, 0);
    pieces.push(geo);
  }

  if (def.cap) {
    const ball = new THREE.SphereGeometry(def.cap.radius, RADIAL * 2, RADIAL);
    ball.translate(0, -h, 0);
    pieces.push(ball);
  }

  return pieces.length === 1 ? pieces[0] : mergeInto(pieces);
}

export class CharacterView {
  /**
   * @param {object} opts { color, accent, skin, castShadow }
   */
  constructor(opts = {}) {
    /**
     * Only the player casts by default.
     *
     * A rig is fifteen separate meshes, so six racers is ninety draw calls -
     * and the shadow pass draws every caster a second time. Letting the whole
     * field cast took a six-racer level to 190 draws against a budget of 120,
     * to buy shadows under opponents who are mostly ahead of the camera and
     * often past the impostor distance anyway. The player's own shadow is the
     * one that matters: it is how you read your height over the ground.
     */
    const castShadow = opts.castShadow ?? false;
    const palette = {
      primary: opts.color ?? 0xff7a3d,
      accent: opts.accent ?? 0x2b3350,
      skin: opts.skin ?? SKIN,
      none: 0x000000,
    };

    this.root = new THREE.Group();
    /** Indexed by BONE id, so applying a pose is a flat loop. */
    this.bones = new Array(BONE_COUNT);
    this.materials = [];

    for (let i = 0; i < BONES.length; i++) {
      const def = BONES[i];
      const group = new THREE.Group();
      group.position.set(def.offset[0], def.offset[1], def.offset[2]);

      // The root bone is the transform everything hangs off and draws nothing.
      if (def.size[0] > 0) {
        const geo = boneGeometry(def);
        // Phong, matching the level: a runner lit only diffusely reads as felt
        // against surfaces that now catch a highlight.
        const mat = new THREE.MeshPhongMaterial({
          color: palette[def.part] ?? palette.primary,
          specular: 0x2a2f3d, shininess: 18,
        });
        this.materials.push(mat);
        const mesh = new THREE.Mesh(geo, mat);
        // Casts but does not receive: self-shadowing across fifteen touching
        // boxes is noise, and the runner is lit from one side anyway.
        mesh.castShadow = castShadow;
        group.add(mesh);
      }

      this.bones[i] = group;
      if (def.parent < 0) this.root.add(group);
      else this.bones[def.parent].add(group);
    }

    // Hang the skeleton back down from the pivot, so an unrotated body still
    // stands with its feet at the simulation's position.
    this.bones[BONE.ROOT].position.y = -PIVOT_Y;

    this.animator = makeAnimator();
    /** Drained by whoever wants footstep audio. */
    this.events = this.animator.events;
  }

  /**
   * Poses the rig from simulation state.
   *
   * @param {object} p   racer, or the interpolated render proxy
   * @param {number} dt  seconds since the last rendered frame
   */
  pose(p, dt) {
    const pose = stepAnimator(this.animator, p, dt);

    for (let i = 0; i < BONE_COUNT; i++) {
      const o = i * 3;
      this.bones[i].rotation.set(pose[o], pose[o + 1], pose[o + 2]);
    }

    // The root bone's rotation is the whole-body orientation.
    //
    // The X channel used to be dropped here - `set(0, y, z)` - which meant no
    // clip could pitch the body forward or back at all. A somersault is exactly
    // that pitch, so flips were impossible by construction rather than merely
    // unwritten. All three channels pass through now.
    //
    // The group also sits a hip's height above the simulation's position, with
    // the skeleton hung back down from it, so the body rotates about its middle
    // rather than about its ankles. Pivoting at the feet turns a somersault
    // into the runner sweeping a huge arc through the floor, and it made the
    // ordinary running lean pivot from the wrong place too.
    const rootRot = this.bones[BONE.ROOT].rotation;
    this.root.position.set(p.pos.x, p.pos.y + PIVOT_Y, p.pos.z);
    this.root.rotation.set(rootRot.x, rootRot.y, rootRot.z);
    rootRot.set(0, 0, 0);
  }

  get height() {
    return BODY.height;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
