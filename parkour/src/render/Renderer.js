/**
 * The WebGL layer.
 *
 * Owns the renderer, scene, lights and camera object, and nothing else - it
 * knows how to draw a world it is handed, never how that world got that way.
 * All framing decisions come from sim/camera/CameraController as plain numbers.
 */
import * as THREE from 'three';
import { CAMERA, QUALITY } from '../config.js';
import { getTheme } from '../data/themes.js';

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts { tier: 'low'|'medium'|'high' }
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.tier = opts.tier || 'medium';
    const q = QUALITY[this.tier];

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: q.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatioCap));
    this.renderer.shadowMap.enabled = q.shadows;
    if (q.shadows) this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fovLandscape, 1, CAMERA.near, CAMERA.far,
    );

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.position.set(-24, 40, -18);
    // Framed unconditionally, not only when shadows are on: an adaptive
    // downgrade can turn them off and a Settings change can turn them back on,
    // and a shadow camera configured only at construction would leave the second
    // case rendering shadows through a default 5x5 frustum.
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.far = 160;
    this.sun.castShadow = q.shadows;
    this.scene.add(this.sun);
    // The sun follows the runner, so its target has to be in the scene too.
    this.scene.add(this.sun.target);

    this._size = { width: 0, height: 0 };
    this.resize();
  }

  /**
   * Switches quality tier on a live renderer.
   *
   * Pixel ratio, shadows and the light budget all move immediately; antialiasing
   * cannot, because it is fixed when the WebGL context is created and changing
   * it would mean tearing down the context and every GPU resource hanging off
   * it mid-race. Dropping a tier without it still removes the great majority of
   * the cost, so the honest trade is to apply what can be applied now and let
   * antialiasing follow on the next load.
   *
   * @returns {boolean} whether anything changed
   */
  setTier(tier) {
    const q = QUALITY[tier];
    if (!q || tier === this.tier) return false;
    const shadowsChanged = q.shadows !== QUALITY[this.tier].shadows;
    this.tier = tier;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatioCap));
    this.renderer.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;

    // three.js compiles shadow sampling into the shader program, so a material
    // built while shadows were on keeps sampling a map nobody is drawing any
    // more. Flagging every material forces one recompile pass - expensive, but
    // it happens at most twice a session and the alternative is a scene lit by
    // a stale shadow map.
    if (shadowsChanged) {
      this.renderer.shadowMap.needsUpdate = true;
      this.scene.traverse((o) => {
        const m = o.material;
        if (!m) return;
        if (Array.isArray(m)) for (const sub of m) sub.needsUpdate = true;
        else m.needsUpdate = true;
      });
    }
    return true;
  }

  applyTheme(themeId) {
    const t = getTheme(themeId);
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
    this.hemi.color.setHex(t.hemiSky);
    this.hemi.groundColor.setHex(t.hemiGround);
    this.sun.color.setHex(t.sunColor);
    this.sun.intensity = t.sunIntensity;
    return t;
  }

  /** Copies the simulation's camera numbers onto the three.js camera. */
  syncCamera(cam) {
    this.camera.position.set(
      cam.pos.x + cam.shakeOffsetX,
      cam.pos.y + cam.shakeOffsetY,
      cam.pos.z,
    );
    this.camera.lookAt(cam.look.x, cam.look.y, cam.look.z);
    if (this.camera.fov !== cam.fov) {
      this.camera.fov = cam.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Keeps the shadow frustum centred on the action rather than on the origin. */
  followSun(x, y, z) {
    this.sun.position.set(x - 24, y + 40, z - 18);
    this.sun.target.position.set(x, y, z);
    this.sun.target.updateMatrixWorld();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w === this._size.width && h === this._size.height) return false;
    this._size.width = w;
    this._size.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    return true;
  }

  get width() { return this._size.width; }
  get height() { return this._size.height; }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  get drawCalls() {
    return this.renderer.info.render.calls;
  }

  get triangles() {
    return this.renderer.info.render.triangles;
  }

  dispose() {
    this.renderer.dispose();
  }
}
