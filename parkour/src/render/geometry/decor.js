/**
 * The world beyond the track.
 *
 * The course itself is only ten metres wide; everything that makes it read as a
 * *place* - a skyline to be above, pillars to run between, a horizon that moves
 * - lives out here. Without it the game is grey boxes on a gradient, which is
 * exactly what it looked like.
 *
 * All of it is instanced: one InstancedMesh per prototype for the whole level,
 * so the entire skyline is a handful of draw calls regardless of how many
 * buildings are in it. Placement is deterministic from the level seed, so a
 * course looks the same every time it is raced.
 */
import * as THREE from 'three';
import { getTheme } from '../../data/themes.js';

/** Per-theme silhouette. Shapes the world without needing new geometry. */
const PROFILES = {
  rooftops: { count: 130, minH: 6, maxH: 40, width: 5.5, spread: 50, near: 19, spacing: 13, jitter: 5 },
  undercity: { count: 150, minH: 9, maxH: 30, width: 4.0, spread: 34, near: 15, spacing: 9, jitter: 3 },
  solarworks: { count: 100, minH: 4, maxH: 20, width: 7.0, spread: 56, near: 21, spacing: 16, jitter: 6 },
  frostline: { count: 110, minH: 5, maxH: 26, width: 6.5, spread: 60, near: 22, spacing: 15, jitter: 7 },
};

/** A small deterministic LCG - decor must not shimmer between runs. */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Builds the decor for a level.
 *
 * @param {object} level  assembled level data
 * @returns {{group: THREE.Group, meshes: THREE.InstancedMesh[], dispose: Function}}
 */
export function buildDecor(level) {
  const theme = getTheme(level.theme);
  const profile = PROFILES[level.theme] || PROFILES.rooftops;
  const rand = rng((level.seed || 1) * 2654435761);

  const group = new THREE.Group();
  group.name = 'decor';

  const startZ = level.startZ - 60;
  const endZ = level.finishZ + 80;
  const span = endZ - startZ;

  // One box geometry shared by every building; the instance matrix does the
  // rest. Anchored at its base so scaling grows it upward, not through the
  // ground.
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);

  const meshes = [];
  const matrix = new THREE.Matrix4();
  const colour = new THREE.Color();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();

  // Two tiers: near blocks that read as structure, far blocks that read as a
  // skyline. Splitting them means the LOD band can drop the far tier alone.
  for (const tier of [
    { name: 'near', count: Math.round(profile.count * 0.55), depth: 0, fade: 0.0 },
    { name: 'far', count: Math.round(profile.count * 0.45), depth: 1, fade: 0.45 },
  ]) {
    const material = new THREE.MeshLambertMaterial({ vertexColors: false, color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, material, tier.count);
    mesh.name = `decor-${tier.name}`;
    mesh.frustumCulled = false;
    // Only the near tier casts: the far tier is beyond the shadow frustum, so
    // including it would cost fill rate for shadows nobody can see.
    mesh.castShadow = tier.depth === 0;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(tier.count * 3), 3,
    );

    for (let i = 0; i < tier.count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const t = (i / tier.count) + (rand() - 0.5) * 0.02;
      const z = startZ + t * span + (rand() - 0.5) * profile.jitter * 2;

      // Far tier sits further out and taller, which is what makes it read as
      // distance rather than as more of the same.
      const out = tier.depth === 0
        ? profile.near + rand() * profile.spread * 0.35
        : profile.near + profile.spread * (0.4 + rand() * 0.75);
      const h = profile.minH + rand() * (profile.maxH - profile.minH)
        * (tier.depth === 0 ? 0.5 : 1.3);
      const w = profile.width * (0.6 + rand() * 0.9);
      const d = profile.width * (0.6 + rand() * 1.4);

      pos.set(side * out, -1 - rand() * 3, z);
      scale.set(w, h, d);
      matrix.compose(pos, quat, scale);
      mesh.setMatrixAt(i, matrix);

      // Tint from the theme's decor palette, darkened with distance so the far
      // tier recedes rather than competing with the track.
      const base = theme.decor[i % theme.decor.length];
      colour.setHex(base);
      const shade = (0.75 + rand() * 0.45) * (1 - tier.fade);
      mesh.instanceColor.setXYZ(i, colour.r * shade, colour.g * shade, colour.b * shade);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    meshes.push(mesh);
  }

  return {
    group,
    meshes,
    /** Hides the far tier on low tiers - the cheapest quality lever available. */
    setDetail(level2) {
      if (meshes[1]) meshes[1].visible = level2 !== 'low';
    },
    dispose() {
      geo.dispose();
      for (const m of meshes) m.material.dispose();
    },
  };
}

export { PROFILES };
