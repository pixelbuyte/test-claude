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
import * as THREE from 'three';
import { BODY } from '../../config.js';
import { BONES, BONE, BONE_COUNT } from '../../data/anim/rig.js';
import { makeAnimator, stepAnimator } from '../../sim/anim/AnimationController.js';

const SKIN = 0xf0c8a0;

export class CharacterView {
  /**
   * @param {object} opts { color, accent, skin }
   */
  constructor(opts = {}) {
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
        const geo = new THREE.BoxGeometry(def.size[0], def.size[1], def.size[2]);
        // Boxes hang downward from their joint, so rotating the joint swings the
        // limb rather than spinning it about its middle.
        geo.translate(0, -def.size[1] / 2, 0);
        const mat = new THREE.MeshLambertMaterial({ color: palette[def.part] ?? palette.primary });
        this.materials.push(mat);
        group.add(new THREE.Mesh(geo, mat));
      }

      this.bones[i] = group;
      if (def.parent < 0) this.root.add(group);
      else this.bones[def.parent].add(group);
    }

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
    this.root.position.set(p.pos.x, p.pos.y, p.pos.z);

    const pose = stepAnimator(this.animator, p, dt);

    for (let i = 0; i < BONE_COUNT; i++) {
      const o = i * 3;
      this.bones[i].rotation.set(pose[o], pose[o + 1], pose[o + 2]);
    }

    // The root bone's rotation is the whole-body lean; position stays on the
    // simulation's, so the body never drifts away from its own collider.
    const rootRot = this.bones[BONE.ROOT].rotation;
    this.root.rotation.set(0, rootRot.y, rootRot.z);
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
