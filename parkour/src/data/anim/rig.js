/**
 * The skeleton, as data.
 *
 * Fifteen bones of plain hierarchy - no SkinnedMesh, no weights, no model file.
 * Every character shares this rig, which is what lets every clip apply to all of
 * them and lets a distant opponent drop to a two-box impostor with no
 * special-casing anywhere.
 *
 * Pure data: importable from Node, so clips can be tested without a browser.
 */

/** Bone ids. The order is the layout of the pose buffer, so it is load-bearing. */
export const BONE = {
  ROOT: 0,
  HIPS: 1,
  SPINE: 2,
  CHEST: 3,
  HEAD: 4,
  ARM_L: 5,
  FOREARM_L: 6,
  ARM_R: 7,
  FOREARM_R: 8,
  THIGH_L: 9,
  SHIN_L: 10,
  THIGH_R: 11,
  SHIN_R: 12,
  FOOT_L: 13,
  FOOT_R: 14,
};

export const BONE_COUNT = 15;

/** Three Euler channels per bone. */
export const POSE_STRIDE = 3;
export const POSE_SIZE = BONE_COUNT * POSE_STRIDE;

/**
 * @typedef {object} BoneDef
 * @property {string} name
 * @property {number} parent      BONE id, or -1 for the root
 * @property {number[]} offset    position relative to the parent, in metres
 * @property {number[]} size      box dimensions for the default proportions
 * @property {string} part        which palette slot colours it
 */
export const BONES = [
  { name: 'root', parent: -1, offset: [0, 0, 0], size: [0, 0, 0], part: 'none' },
  { name: 'hips', parent: BONE.ROOT, offset: [0, 0.92, 0], size: [0.30, 0.20, 0.22], part: 'accent' },
  { name: 'spine', parent: BONE.HIPS, offset: [0, 0.16, 0], size: [0.34, 0.22, 0.22], part: 'primary' },
  { name: 'chest', parent: BONE.SPINE, offset: [0, 0.20, 0], size: [0.42, 0.26, 0.24], part: 'primary' },
  { name: 'head', parent: BONE.CHEST, offset: [0, 0.30, 0], size: [0.26, 0.26, 0.26], part: 'skin' },

  { name: 'armL', parent: BONE.CHEST, offset: [-0.26, 0.08, 0], size: [0.12, 0.28, 0.12], part: 'accent' },
  { name: 'forearmL', parent: BONE.ARM_L, offset: [0, -0.26, 0], size: [0.11, 0.26, 0.11], part: 'skin' },
  { name: 'armR', parent: BONE.CHEST, offset: [0.26, 0.08, 0], size: [0.12, 0.28, 0.12], part: 'accent' },
  { name: 'forearmR', parent: BONE.ARM_R, offset: [0, -0.26, 0], size: [0.11, 0.26, 0.11], part: 'skin' },

  { name: 'thighL', parent: BONE.HIPS, offset: [-0.11, -0.12, 0], size: [0.15, 0.32, 0.15], part: 'primary' },
  { name: 'shinL', parent: BONE.THIGH_L, offset: [0, -0.32, 0], size: [0.13, 0.30, 0.13], part: 'accent' },
  { name: 'thighR', parent: BONE.HIPS, offset: [0.11, -0.12, 0], size: [0.15, 0.32, 0.15], part: 'primary' },
  { name: 'shinR', parent: BONE.THIGH_R, offset: [0, -0.32, 0], size: [0.13, 0.30, 0.13], part: 'accent' },

  { name: 'footL', parent: BONE.SHIN_L, offset: [0, -0.30, 0.03], size: [0.14, 0.09, 0.22], part: 'accent' },
  { name: 'footR', parent: BONE.SHIN_R, offset: [0, -0.30, 0.03], size: [0.14, 0.09, 0.22], part: 'accent' },
];

/** A flat pose buffer, ready to be sampled into. */
export function makePose() {
  return new Float32Array(POSE_SIZE);
}
