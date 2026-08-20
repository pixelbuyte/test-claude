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
import * as THREE from '../../vendor/three/three.module.min.js';
import { KIND, FLAG } from '../config.js';
import { getTheme } from '../data/themes.js';
import { mergeBoxes } from './geometry/boxMerge.js';
import { buildDecor } from './geometry/decor.js';

/** Track markings. Tuned to read at 20 m/s, not to survive close inspection. */
const MARKS = {
  /** Continuous stripe hugging each outer edge of the running surface. */
  edgeWidth: 0.3,
  /** Centre guide dots - the breadcrumb trail that says "the route goes here". */
  dotSize: 0.5,
  dotSpacing: 2.6,
  /** Dashed lane dividers, world-aligned so they run through chunk seams. */
  dashWidth: 0.16,
  dashLength: 1.7,
  dashSpacing: 5.5,
  /** Sat on top of the surface, not sunk into it - z-fighting is worse than a lip. */
  lift: 0.025,
  thickness: 0.03,
  /**
   * Markings are pushed past white so the bloom pass treats them as light.
   *
   * This is the cheapest strong image in the game: two lit lines converging on
   * the vanishing point through a dark city. It costs nothing at all - the
   * boxes were already being merged, and this is a different number in the
   * colour attribute they already carried.
   *
   * The edges glow harder than the dashes on purpose. The edges say where the
   * track ends, which is safety information and should read at any distance;
   * the dashes say how fast you are going, and want to stream past rather than
   * smear into one continuous bright band.
   */
  edgeGlow: 3.0,
  dashGlow: 1.9,
};

/**
 * Could this collider be a surface the runner runs along?
 *
 * Shape alone cannot settle it: an overhead bar is exactly as wide, as long and
 * as solid as a floor, and painting lane dashes on top of one hangs a ladder in
 * the sky. This is the shape half; `pushMarkings` is only called for candidates
 * near the section's own base height, which is the half that rules bars out.
 *
 * `chunkRanges[].floorY` is deliberately not used here - it is the death plane,
 * thirty metres below anything runnable, not the running floor.
 */
function isSurfaceCandidate(cs, i) {
  if (cs.kind[i] !== KIND.SOLID) return false;
  if ((cs.flags[i] & (FLAG.HAZARD | FLAG.BOOST)) !== 0) return false;
  if (cs.maxX[i] - cs.minX[i] < 6) return false;
  if (cs.maxZ[i] - cs.minZ[i] < 3) return false;
  return cs.maxY[i] - cs.minY[i] >= 0.8;
}

/** How far above a section's lowest running surface still counts as one. */
const MARK_STOREY = 3;

/**
 * Paints a running surface: two edge stripes and dashed lane dividers.
 *
 * These are the cheapest speed cue in the game. A featureless slab gives the eye
 * nothing to measure motion against, so 20 m/s and 9 m/s look the same; dashes
 * streaming past make the difference obvious without a single UI element.
 *
 * They cost no draw calls at all - the boxes merge into the section mesh the
 * surface itself is in.
 */
function pushMarkings(out, cs, i, theme) {
  const g = theme.glow ?? 1;
  const lit = (x) => 1 + (x - 1) * g;
  const y = cs.maxY[i] + MARKS.lift;
  const y1 = y + MARKS.thickness;
  const z0 = cs.minZ[i];
  const z1 = cs.maxZ[i];
  const colour = theme.mark ?? theme.rail;

  for (const x of [cs.minX[i], cs.maxX[i] - MARKS.edgeWidth]) {
    out.push({
      minX: x, maxX: x + MARKS.edgeWidth,
      minY: y, maxY: y1,
      minZ: z0, maxZ: z1,
      color: colour, shade: lit(MARKS.edgeGlow),
    });
  }

  // A single breadcrumb trail of dots down the centre, not lane dividers: the
  // trail reads as "the route goes this way" at any speed, and dots streaming
  // underfoot are the speed cue the dashes used to be.
  const centreX = (cs.minX[i] + cs.maxX[i]) * 0.5;
  const x = centreX - MARKS.dotSize * 0.5;
  // Phase from world Z rather than from the surface's own start, so the trail
  // stays in step across a seam instead of restarting at every chunk boundary.
  const first = Math.ceil(z0 / MARKS.dotSpacing) * MARKS.dotSpacing;
  for (let z = first; z + MARKS.dotSize <= z1; z += MARKS.dotSpacing) {
    out.push({
      minX: x, maxX: x + MARKS.dotSize,
      minY: y, maxY: y1,
      minZ: z, maxZ: z + MARKS.dotSize,
      color: colour, shade: lit(MARKS.dashGlow),
    });
  }
}

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

/**
 * How much brighter than white a surface is meant to be.
 *
 * This is how a surface becomes a *light source* rather than a lit thing, and
 * it costs nothing: the merged geometry already carries a per-box colour, the
 * render target is half-float so values above 1 survive, and the bloom pass
 * picks up whatever crosses its threshold. The alternative - a second emissive
 * material per section - would have doubled the draw calls to say the same
 * thing, because `emissive` is a uniform and cannot vary per box within a merge.
 */
function glowFor(cs, i, theme) {
  const flags = cs.flags[i];
  const g = theme.glow ?? 1;
  // Scaled toward 1 rather than multiplied: at glow 0 a surface should be
  // ordinary, not black.
  const lit = (x) => 1 + (x - 1) * g;
  if ((flags & FLAG.BOOST) !== 0) return lit(3.2);
  if ((flags & FLAG.HAZARD) !== 0) return lit(2.0);
  if (cs.kind[i] === KIND.RAIL) return lit(2.4);
  return 1;
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

    // Phong rather than Lambert: Lambert is pure diffuse, so metal, glass,
    // concrete and ice all responded to light identically and every surface read
    // as the same matte plastic. Phong adds a specular term for a fraction of
    // what MeshStandardMaterial's full PBR would cost on a phone - and with no
    // textures anywhere, roughness and metalness maps would have nothing to
    // sample, so the extra cost would buy nothing.
    this.material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      specular: 0x1c2230,
      shininess: 24,
      // Faces are flat-shaded facets; letting three smooth them would undo the
      // whole look.
      flatShading: false,
    });

    this._build();
  }

  _build() {
    const { colliders: cs, chunkRanges } = this.level;
    const theme = this.theme;

    const moverIndices = new Set(this.level.movers.map((m) => m.index));

    // Bucket every drawable collider into the section that contains it.
    const buckets = chunkRanges.map(() => []);
    /** Surface candidates per section, and the lowest top face among them. */
    const candidates = chunkRanges.map(() => []);
    const baseY = chunkRanges.map(() => Infinity);

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
        shade: shadeFor(cs, i) * glowFor(cs, i, theme),
      });

      // A wall you can run along says so: an accent stripe at hand height down
      // both faces. This is affordance paint, not decoration - it is how the
      // player learns which grey slab is a route.
      if (cs.kind[i] === KIND.WALLRUNNABLE && cs.maxY[i] - cs.minY[i] >= 1.6) {
        const g = theme.glow ?? 1;
        const y0 = cs.minY[i] + 1.55;
        const y1 = Math.min(cs.maxY[i], y0 + 0.3);
        for (const face of [cs.minX[i], cs.maxX[i]]) {
          buckets[s].push({
            minX: face - 0.035, maxX: face + 0.035,
            minY: y0, maxY: y1,
            minZ: cs.minZ[i], maxZ: cs.maxZ[i],
            color: theme.accent, shade: 1 + 0.6 * g,
          });
        }
      }

      if (isSurfaceCandidate(cs, i)) {
        candidates[s].push(i);
        if (cs.maxY[i] < baseY[s]) baseY[s] = cs.maxY[i];
      }
    }

    // Now that each section's base height is known, the candidates near it are
    // the running surfaces and everything a storey or more above is overhead.
    for (let s = 0; s < candidates.length; s++) {
      for (const i of candidates[s]) {
        if (cs.maxY[i] <= baseY[s] + MARK_STOREY) pushMarkings(buckets[s], cs, i, theme);
      }
    }

    for (let s = 0; s < buckets.length; s++) {
      if (buckets[s].length === 0) continue;
      const mesh = new THREE.Mesh(mergeBoxes(buckets[s]), this.material);
      // The shadow system was fully configured and no mesh opted in, so it
      // rendered nothing at all. Level geometry both casts and receives: a crate
      // needs to drop a shadow onto the floor beside it, not just catch one.
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `section-${s}`;
      mesh.matrixAutoUpdate = false;
      mesh.userData.z0 = chunkRanges[s].z0;
      mesh.userData.z1 = chunkRanges[s].z1;
      this.group.add(mesh);
      this.sectionMeshes.push(mesh);
    }

    this._buildMovers();
    this._buildPickups();
    this._buildFinishGate();

    // The world beyond the track. Instanced, so the whole skyline is two draw
    // calls however many buildings are in it.
    this.decor = buildDecor(this.level);
    this.group.add(this.decor.group);
  }

  /**
   * A checkered gate over the finish line, plus a checkered strip on the
   * ground under it. Purely visual - the finish itself is the invisible
   * trigger the builder placed - but a race needs somewhere to *see* itself
   * end, and one merged mesh costs a single draw call.
   */
  _buildFinishGate() {
    const cs = this.level.colliders;
    let trigger = -1;
    for (let i = 0; i < cs.count; i++) {
      if ((cs.flags[i] & FLAG.FINISH) !== 0) { trigger = i; break; }
    }
    if (trigger < 0) return;

    // The builder makes the finish volume span [ground - 2, ground + 8].
    const ground = cs.minY[trigger] + 2;
    const z = cs.minZ[trigger];
    const dark = 0x20293a;
    const light = 0xffffff;
    const boxes = [];

    for (const side of [-1, 1]) {
      boxes.push({
        minX: side * 7.4 - 0.35, maxX: side * 7.4 + 0.35,
        minY: ground, maxY: ground + 5.2,
        minZ: z - 0.35, maxZ: z + 0.35,
        color: light, shade: 1,
      });
    }

    // The beam is the checkers themselves: two rows of alternating cells.
    const cell = 0.775;
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < 20; c++) {
        boxes.push({
          minX: -7.75 + c * cell, maxX: -7.75 + (c + 1) * cell,
          minY: ground + 5.2 + row * cell, maxY: ground + 5.2 + (row + 1) * cell,
          minZ: z - 0.28, maxZ: z + 0.28,
          color: (c + row) % 2 === 0 ? dark : light, shade: 1,
        });
      }
    }

    // And painted on the ground, where the runner actually crosses it.
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < 20; c++) {
        boxes.push({
          minX: -7.75 + c * cell, maxX: -7.75 + (c + 1) * cell,
          minY: ground + 0.02, maxY: ground + 0.05,
          minZ: z - 1.6 + row * cell, maxZ: z - 1.6 + (row + 1) * cell,
          color: (c + row) % 2 === 0 ? dark : light, shade: 1,
        });
      }
    }

    const mesh = new THREE.Mesh(mergeBoxes(boxes), this.material);
    mesh.name = 'finish-gate';
    this.group.add(mesh);
    this.finishGate = mesh;
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
      mesh.castShadow = true;
      mesh.receiveShadow = true;
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
    // Pushed well past white on purpose: a coin should be the brightest thing on
    // screen and throw a halo, which is what makes it read as worth chasing.
    const mat = new THREE.MeshPhongMaterial({
      color: 0xffd85e, emissive: 0xffc02a, emissiveIntensity: 2.4,
      specular: 0xffffff, shininess: 60,
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

  /** Drops the far skyline tier on the low quality tier. */
  setDetail(tier) {
    if (this.decor) this.decor.setDetail(tier);
  }

  dispose() {
    if (this.decor) this.decor.dispose();
    if (this.finishGate) this.finishGate.geometry.dispose();
    for (const mesh of this.sectionMeshes) mesh.geometry.dispose();
    for (const { mesh } of this.moverMeshes) mesh.geometry.dispose();
    if (this.pickupMesh) {
      this.pickupMesh.geometry.dispose();
      this.pickupMesh.material.dispose();
    }
    this.material.dispose();
  }
}
