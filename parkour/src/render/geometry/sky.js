/**
 * The sky.
 *
 * `scene.background = new THREE.Color(...)` is one flat colour, and the fog
 * fades every distant thing into it - so the horizon reads as a wall the world
 * stops at rather than as depth. A gradient dome fixes that for one draw call:
 * an inverted sphere with vertex colours running zenith -> sky -> horizon, with
 * the horizon band set to the fog colour exactly, so whatever the fog swallows
 * dissolves into the sky instead of stopping against it.
 *
 * Colours are derived from the theme rather than authored, so a new theme gets a
 * matching sky for free and the two can never drift apart.
 */
import * as THREE from '../../../vendor/three/three.module.min.js';

/** Radius: comfortably inside CAMERA.far (320) with room for the boom. */
const RADIUS = 290;

/**
 * Where each gradient stop sits, as sin(latitude): -1 straight down, 0 the
 * horizon, +1 straight up.
 */
const STOPS = [
  { at: -0.35, key: 'ground' },
  { at: 0.0, key: 'horizon' },
  // Low, because the camera only ever looks a little above the horizon: put the
  // sky band at 0.5 and the whole visible strip is horizon colour.
  { at: 0.14, key: 'sky' },
  { at: 1.0, key: 'zenith' },
];

const scratch = new THREE.Color();
const a = new THREE.Color();
const b = new THREE.Color();

/** Same hue, scaled lightness - keeps derived stops inside the theme's palette. */
function shift(hex, lightnessScale, out) {
  out.setHex(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  out.getHSL(hsl);
  out.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * lightnessScale)));
  return out;
}

/**
 * A sky dome. Call `applyTheme` to colour it and `follow` once per frame.
 *
 * @returns {{mesh: THREE.Mesh, applyTheme: Function, follow: Function, dispose: Function}}
 */
export function buildSky() {
  // Few segments: the gradient is per-vertex and smooth, so rings buy nothing
  // beyond banding resistance. 16 rings is already below the eye's threshold.
  const geo = new THREE.SphereGeometry(RADIUS, 24, 16);
  const count = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    // Excluded from fog on purpose: the dome *is* what the fog fades into, so
    // fogging it would wash the gradient into a single colour again.
    fog: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  // Drawn first, with no depth write, so every solid thing overwrites it and it
  // costs one full-screen fill rather than sorting against the level.
  mesh.renderOrder = -1;
  mesh.matrixAutoUpdate = false;

  return {
    mesh,

    /**
     * Recolours the dome from a theme palette.
     *
     * @param {object} t theme record from data/themes.js
     */
    applyTheme(t) {
      const bands = {
        // Below the horizon is never really seen - the level covers it - but it
        // has to exist or the bottom of the dome is undefined black in the gaps
        // between platforms.
        ground: shift(t.fog, 0.55, new THREE.Color()),
        // The horizon is the fog colour exactly. That equality is the point of
        // the whole file.
        horizon: new THREE.Color(t.fog),
        sky: new THREE.Color(t.sky),
        // Themes keep sky and fog close together, so a gradient between just
        // those two is invisible in practice - the first version of this was.
        // The zenith has to be pushed well past the palette for the dome to
        // read as depth rather than as another flat fill.
        zenith: shift(t.sky, 0.34, new THREE.Color()),
      };

      const pos = geo.attributes.position;
      const col = geo.attributes.color;

      for (let i = 0; i < count; i++) {
        const y = pos.getY(i) / RADIUS;   // -1..1

        // Find the pair of stops this vertex falls between.
        let s = 0;
        while (s < STOPS.length - 2 && y > STOPS[s + 1].at) s++;
        const lo = STOPS[s];
        const hi = STOPS[s + 1];
        const span = hi.at - lo.at;
        let k = span > 0 ? (y - lo.at) / span : 0;
        k = Math.max(0, Math.min(1, k));
        // Smoothstep, so the band edges are not visible as creases.
        k = k * k * (3 - 2 * k);

        a.copy(bands[lo.key]);
        b.copy(bands[hi.key]);
        scratch.copy(a).lerp(b, k);
        col.setXYZ(i, scratch.r, scratch.g, scratch.b);
      }
      col.needsUpdate = true;
    },

    /** Pins the dome to the camera, so it can never be walked out of. */
    follow(x, y, z) {
      mesh.matrix.makeTranslation(x, y, z);
      mesh.matrixWorldNeedsUpdate = true;
    },

    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}

export { RADIUS as SKY_RADIUS };
