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
 * @property {number[]} size      overall dimensions for the default proportions
 * @property {string} part        which palette slot colours it
 * @property {string} [shape]     'capsule' (default), 'sphere' or 'box'
 * @property {object} [cap]       a ball merged onto the bone's far end
 * @property {number} cap.radius
 * @property {string} cap.part
 *
 * `shape` is the difference between a runner and a stack of crates. Boxes were
 * the first thing that worked and they never got revisited: fifteen hard-edged
 * cubes read as scenery that happens to be person-shaped. Capsules and spheres
 * cost nothing extra in draw calls - still one mesh per bone - and their normals
 * are smooth, so the body catches light in gradients instead of in flat plates.
 *
 * `cap` exists so hands and boots can be round without new bones. A bone is a
 * pose-buffer slot and every clip is written against these fifteen; adding two
 * would silently invalidate all sixteen clips. Merging a ball into the forearm's
 * own geometry gives mitten hands for zero bones and zero extra draw calls.
 */
export const BONES = [
  { name: 'root', parent: -1, offset: [0, 0, 0], size: [0, 0, 0], part: 'none' },

  // Shorts. Short and wide, so they read as a garment rather than as a joint.
  { name: 'hips', parent: BONE.ROOT, offset: [0, 0.92, 0], size: [0.36, 0.26, 0.27], part: 'accent', shape: 'capsule' },

  // The spine draws nothing, and that is the whole trick.
  //
  // Three separate torso capsules made a snowman: each segment is short enough
  // that its capsule degenerates to a sphere, so the body read as a stack of
  // balls instead of a shirt. One tall shape hung off the chest covers the
  // whole torso in a single continuous form. The bone still exists and still
  // rotates - every clip animates it and the chest hangs off it - it simply has
  // no geometry of its own.
  { name: 'spine', parent: BONE.HIPS, offset: [0, 0.17, 0], size: [0, 0, 0], part: 'none' },
  { name: 'chest', parent: BONE.SPINE, offset: [0, 0.20, 0], size: [0.46, 0.54, 0.29], part: 'primary', shape: 'capsule' },

  // A big round head is most of what makes the silhouette read as a character
  // rather than as a shape. Slightly wider than tall, like the reference.
  { name: 'head', parent: BONE.CHEST, offset: [0, 0.10, 0], size: [0.34, 0.32, 0.32], part: 'skin', shape: 'sphere' },

  // Sleeves take the shirt colour so the arm joins the torso instead of hanging
  // off it, and only the mitt is accent - which is what the reference does.
  { name: 'armL', parent: BONE.CHEST, offset: [-0.26, -0.06, 0], size: [0.14, 0.28, 0.14], part: 'primary', shape: 'capsule' },
  { name: 'forearmL', parent: BONE.ARM_L, offset: [0, -0.27, 0], size: [0.125, 0.26, 0.125], part: 'primary', shape: 'capsule', cap: { radius: 0.10, part: 'accent' } },
  { name: 'armR', parent: BONE.CHEST, offset: [0.26, -0.06, 0], size: [0.14, 0.28, 0.14], part: 'primary', shape: 'capsule' },
  { name: 'forearmR', parent: BONE.ARM_R, offset: [0, -0.27, 0], size: [0.125, 0.26, 0.125], part: 'primary', shape: 'capsule', cap: { radius: 0.10, part: 'accent' } },

  { name: 'thighL', parent: BONE.HIPS, offset: [-0.11, -0.15, 0], size: [0.17, 0.32, 0.17], part: 'primary', shape: 'capsule' },
  { name: 'shinL', parent: BONE.THIGH_L, offset: [0, -0.32, 0], size: [0.15, 0.30, 0.15], part: 'primary', shape: 'capsule' },
  { name: 'thighR', parent: BONE.HIPS, offset: [0.11, -0.15, 0], size: [0.17, 0.32, 0.17], part: 'primary', shape: 'capsule' },
  { name: 'shinR', parent: BONE.THIGH_R, offset: [0, -0.32, 0], size: [0.15, 0.30, 0.15], part: 'primary', shape: 'capsule' },

  // Boots stay boxes: a foot needs a flat sole and a square toe to read as
  // planted, and a capsule here makes the runner look like it is on tiptoe.
  { name: 'footL', parent: BONE.SHIN_L, offset: [0, -0.30, 0.04], size: [0.16, 0.10, 0.24], part: 'accent', shape: 'box' },
  { name: 'footR', parent: BONE.SHIN_R, offset: [0, -0.30, 0.04], size: [0.16, 0.10, 0.24], part: 'accent', shape: 'box' },
];

/** A flat pose buffer, ready to be sampled into. */
export function makePose() {
  return new Float32Array(POSE_SIZE);
}
