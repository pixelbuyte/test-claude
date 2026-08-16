/**
 * Merges many axis-aligned boxes into one geometry.
 *
 * Every collider in this game is a box, so a whole section of level collapses
 * into a single draw call instead of one per crate. Writing straight into
 * preallocated typed arrays keeps that cheap enough to do at load time and never
 * again - there is no runtime geometry creation anywhere in the game, and so no
 * GC churn mid-race.
 *
 * Geometry is non-indexed on purpose: faces need their own normals to read as
 * flat-shaded facets, and sharing vertices between faces would smooth them.
 */
import * as THREE from '../../../vendor/three/three.module.min.js';

/** Unit-cube face definition: 4 corners (as ±0.5 offsets) plus a normal. */
const FACES = [
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];

/** Two triangles per face, as indices into that face's 4 corners. */
const TRIS = [0, 1, 2, 0, 2, 3];

const VERTS_PER_BOX = FACES.length * TRIS.length; // 36

/**
 * @typedef {object} BoxSpec
 * @property {number} minX @property {number} minY @property {number} minZ
 * @property {number} maxX @property {number} maxY @property {number} maxZ
 * @property {number} color  0xRRGGBB
 * @property {number} [shade] per-box brightness multiplier, default 1
 */

/**
 * @param {BoxSpec[]} boxes
 * @returns {THREE.BufferGeometry} with position, normal and color attributes
 */
export function mergeBoxes(boxes) {
  const n = boxes.length;
  const positions = new Float32Array(n * VERTS_PER_BOX * 3);
  const normals = new Float32Array(n * VERTS_PER_BOX * 3);
  const colors = new Float32Array(n * VERTS_PER_BOX * 3);

  let o = 0;
  const c = new THREE.Color();

  for (let i = 0; i < n; i++) {
    const b = boxes[i];
    const cx = (b.minX + b.maxX) * 0.5;
    const cy = (b.minY + b.maxY) * 0.5;
    const cz = (b.minZ + b.maxZ) * 0.5;
    const hx = (b.maxX - b.minX) * 0.5;
    const hy = (b.maxY - b.minY) * 0.5;
    const hz = (b.maxZ - b.minZ) * 0.5;

    c.setHex(b.color ?? 0x808080);
    const shade = b.shade ?? 1;
    const cr = c.r * shade;
    const cg = c.g * shade;
    const cb = c.b * shade;

    for (let f = 0; f < FACES.length; f++) {
      const face = FACES[f];
      const nx = face.n[0], ny = face.n[1], nz = face.n[2];
      // Top faces catch a little more light, undersides a little less. It is a
      // cheap stand-in for ambient occlusion and it stops large flat runs of
      // level from reading as one undifferentiated slab.
      const facing = 1 + ny * 0.12;

      for (let t = 0; t < TRIS.length; t++) {
        const v = face.v[TRIS[t]];
        positions[o] = cx + v[0] * hx;
        positions[o + 1] = cy + v[1] * hy;
        positions[o + 2] = cz + v[2] * hz;
        normals[o] = nx;
        normals[o + 1] = ny;
        normals[o + 2] = nz;
        colors[o] = cr * facing;
        colors[o + 1] = cg * facing;
        colors[o + 2] = cb * facing;
        o += 3;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Vertices one merged box contributes - exported so callers can budget. */
export { VERTS_PER_BOX };
