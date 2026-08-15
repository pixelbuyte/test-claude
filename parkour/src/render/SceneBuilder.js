/**
 * Turns an assembled level into scene geometry.
 *
 * Reads the same ColliderSet the simulation collides against, so what is drawn
 * and what is solid can never drift apart - there is no second, decorative copy
 * of the level to keep in sync.
 *
 * Everything is merged per section, so streaming is `mesh.visible` toggling over
 * a distance window: no geometry is created or destroyed during a race.
 */
import * as THREE from 'three';
import { KIND, FLAG } from '../config.js';
import { getTheme } from '../data/themes.js';
import { mergeBoxes } from './geometry/boxMerge.js';

/** Colour for one collider, from its kind, flags and surface. */
function colorFor(cs, i, theme) {
  const flags = cs.flags[i];
  if ((flags & FLAG.HAZARD) !== 0) return theme.hazard;
  if ((flags & FLAG.BOOST) !== 0) return theme.accent;
  const kind = cs.kind[i];
  if (kind === KIND.VAULTABLE) return theme.vault;
  if (kind === KIND.WALLRUNNABLE) return theme.wall;
  if (kind === KIND.RAIL) return theme.rail;
  return theme.surfaces[cs.surface[i]] ?? theme.surfaces[0];
}

/** Slight per-collider brightness jitter, keyed off position so it is stable. */
function shadeFor(cs, i) {
  const h = Math.abs(Math.sin((cs.minX[i] * 12.9898 + cs.minZ[i] * 78.233) * 0.5));
  return 0.92 + h * 0.16;
}

export class SceneBuilder {
  /**
   * @param {object} level assembled level data
   */
  constructor(level) {
    this.level = level;
    this.theme = getTheme(level.theme);
    this.group = new THREE.Group();
    this.group.name = 'level';

    /** One merged mesh per section, for distance streaming. */
    this.sectionMeshes = [];
    /** Colliders that move; drawn separately because they are not static. */
    this.moverMeshes = [];
    this.pickupMesh = null;

    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });

    this._build();
  }

  _build() {
    const { colliders: cs, chunkRanges } = this.level;
    const theme = this.theme;

    const moverIndices = new Set(this.level.movers.map((m) => m.index));

    // Bucket every drawable collider into the section that contains it.
    const buckets = chunkRanges.map(() => []);
    for (let i = 0; i < cs.count; i++) {
      if (cs.kind[i] === KIND.TRIGGER) continue;   // triggers are invisible
      if (moverIndices.has(i)) continue;           // drawn per-mover instead

      const z = cs.minZ[i];
      let s = chunkRanges.findIndex((r) => z >= r.z0 && z < r.z1);
      if (s < 0) s = chunkRanges.length - 1;

      buckets[s].push({
        minX: cs.minX[i], minY: cs.minY[i], minZ: cs.minZ[i],
        maxX: cs.maxX[i], maxY: cs.maxY[i], maxZ: cs.maxZ[i],
        color: colorFor(cs, i, theme),
        shade: shadeFor(cs, i),
      });
    }

    for (let s = 0; s < buckets.length; s++) {
      if (buckets[s].length === 0) continue;
      const mesh = new THREE.Mesh(mergeBoxes(buckets[s]), this.material);
      mesh.name = `section-${s}`;
      mesh.matrixAutoUpdate = false;
      mesh.userData.z0 = chunkRanges[s].z0;
      mesh.userData.z1 = chunkRanges[s].z1;
      this.group.add(mesh);
      this.sectionMeshes.push(mesh);
    }

    this._buildMovers();
    this._buildPickups();
  }

  _buildMovers() {
    const cs = this.level.colliders;
    for (const m of this.level.movers) {
      const i = m.index;
      const geo = mergeBoxes([{
        minX: -(cs.maxX[i] - cs.minX[i]) / 2, maxX: (cs.maxX[i] - cs.minX[i]) / 2,
        minY: -(cs.maxY[i] - cs.minY[i]) / 2, maxY: (cs.maxY[i] - cs.minY[i]) / 2,
        minZ: -(cs.maxZ[i] - cs.minZ[i]) / 2, maxZ: (cs.maxZ[i] - cs.minZ[i]) / 2,
        color: this.theme.surfaces[cs.surface[i]] ?? this.theme.surfaces[1],
      }]);
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.name = `mover-${i}`;
      this.group.add(mesh);
      this.moverMeshes.push({ mesh, index: i });
    }
  }

  /**
   * Pickups are one InstancedMesh for the whole level. Collecting one writes a
   * zero-scale matrix into its slot - no removal, no allocation, and a retry
   * restores them by rewriting the matrices.
   */
  _buildPickups() {
    const pickups = this.level.pickups;
    if (pickups.length === 0) return;

    const geo = new THREE.OctahedronGeometry(0.34, 0);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffd85e, emissive: 0x6b4a00, emissiveIntensity: 0.6,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, pickups.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.name = 'pickups';
    mesh.frustumCulled = false;

    this._pickupMatrix = new THREE.Matrix4();
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      this._pickupMatrix.makeTranslation(p.x, p.y, p.z);
      mesh.setMatrixAt(i, this._pickupMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    this.group.add(mesh);
    this.pickupMesh = mesh;
  }

  /** Spins uncollected pickups and hides collected ones. */
  updatePickups(world, time) {
    const mesh = this.pickupMesh;
    if (!mesh) return;
    const m = this._pickupMatrix;
    const pickups = this.level.pickups;

    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (world.pickupTaken[i]) {
        m.makeScale(0, 0, 0);
      } else {
        m.makeRotationY(time * 2.2 + i);
        m.setPosition(p.x, p.y + Math.sin(time * 3 + i) * 0.12, p.z);
      }
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** Follows the moving platforms' authoritative positions. */
  updateMovers() {
    const cs = this.level.colliders;
    for (const { mesh, index } of this.moverMeshes) {
      mesh.position.set(
        (cs.minX[index] + cs.maxX[index]) * 0.5,
        (cs.minY[index] + cs.maxY[index]) * 0.5,
        (cs.minZ[index] + cs.maxZ[index]) * 0.5,
      );
    }
  }

  /** Hides sections outside the streaming window around `z`. */
  stream(z, ahead = 180, behind = 60) {
    for (const mesh of this.sectionMeshes) {
      mesh.visible = mesh.userData.z1 > z - behind && mesh.userData.z0 < z + ahead;
    }
  }

  dispose() {
    for (const mesh of this.sectionMeshes) mesh.geometry.dispose();
    for (const { mesh } of this.moverMeshes) mesh.geometry.dispose();
    if (this.pickupMesh) {
      this.pickupMesh.geometry.dispose();
      this.pickupMesh.material.dispose();
    }
    this.material.dispose();
  }
}
