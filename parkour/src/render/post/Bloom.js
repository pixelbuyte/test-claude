/**
 * Bloom.
 *
 * The single biggest thing missing from a night-time city: bright surfaces
 * should bleed light into what surrounds them. Without it a lit rail and a
 * painted rail are the same polygon at different brightness, and the eye reads
 * neither as a light source.
 *
 * Written by hand rather than vendored from three's addons. The addon path is
 * EffectComposer + RenderPass + UnrealBloomPass + CopyShader, four more files of
 * machinery for one effect, most of it plumbing for chains this game will never
 * have. Four small shaders are less code than the plumbing that would run them.
 *
 * The chain is the standard one:
 *
 *   scene -> full-res target
 *         -> bright pass (soft knee)   -> half res
 *         -> gaussian blur, horizontal -> half res
 *         -> gaussian blur, vertical   -> half res
 *         -> composite (scene + glow)  -> canvas
 *
 * Costs three half-res fullscreen passes plus one full-res composite, which is
 * why it belongs to the high tier only.
 */
import * as THREE from 'three';

/** Blurring at half resolution: the result is blurred, so detail is not lost. */
const DOWNSCALE = 2;

/**
 * Nine-tap separable gaussian, the standard sigma-3 weights. Taps sit at
 * fractional offsets so bilinear filtering fetches two texels per sample - nine
 * taps of reach for five fetches.
 */
const BLUR_OFFSETS = [0.0, 1.3846153846, 3.2307692308];
const BLUR_WEIGHTS = [0.2270270270, 0.3162162162, 0.0702702703];

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // The quad is already in clip space; no matrices are involved.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform float threshold;
  uniform float knee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // A soft knee rather than a hard cutoff: a hard one makes surfaces snap
    // into glowing as the camera moves and the shading crosses the threshold.
    float w = clamp((l - threshold) / max(knee, 1e-4), 0.0, 1.0);
    gl_FragColor = vec4(c * w * w, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec2 direction;
  varying vec2 vUv;
  void main() {
    vec4 sum = texture2D(tDiffuse, vUv) * ${BLUR_WEIGHTS[0].toFixed(8)};
    sum += (texture2D(tDiffuse, vUv + direction * ${BLUR_OFFSETS[1].toFixed(8)})
          + texture2D(tDiffuse, vUv - direction * ${BLUR_OFFSETS[1].toFixed(8)}))
          * ${BLUR_WEIGHTS[1].toFixed(8)};
    sum += (texture2D(tDiffuse, vUv + direction * ${BLUR_OFFSETS[2].toFixed(8)})
          + texture2D(tDiffuse, vUv - direction * ${BLUR_OFFSETS[2].toFixed(8)}))
          * ${BLUR_WEIGHTS[2].toFixed(8)};
    gl_FragColor = sum;
  }
`;

const COMPOSITE_FRAG = /* glsl */`
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float strength;
  varying vec2 vUv;

  // three injects the output-colour-space conversion into its own materials'
  // shaders, not into a ShaderMaterial's. Drawing straight to the canvas from a
  // custom shader therefore hands the display linear values it will interpret as
  // sRGB, which renders the whole frame far too dark. The chain stays linear -
  // which is what blurring light wants anyway - and this is the one place it is
  // encoded, at the last write before the canvas.
  vec3 linearToSRGB(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(hi, lo, step(c, vec3(0.0031308)));
  }

  void main() {
    vec3 base = texture2D(tScene, vUv).rgb;
    vec3 glow = texture2D(tBloom, vUv).rgb;
    gl_FragColor = vec4(linearToSRGB(base + glow * strength), 1.0);
  }
`;

/**
 * Can this device actually render into a half-float target?
 *
 * Not every mobile GPU can. Where it cannot, the framebuffer comes back
 * incomplete and the game renders a black screen - which on a phone is
 * indistinguishable from "I pressed start and nothing happened". A renderer for
 * a game whose whole premise is that it runs in a mobile browser has to ask
 * rather than assume.
 */
function canRenderHalfFloat(renderer) {
  const gl = renderer.getContext();
  const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined'
    && gl instanceof WebGL2RenderingContext;
  const ext = renderer.extensions;
  if (isWebGL2) return !!ext.get('EXT_color_buffer_half_float') || !!ext.get('EXT_color_buffer_float');
  return !!ext.get('EXT_color_buffer_half_float');
}

function makeTarget(w, h, type) {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type,
    depthBuffer: true,
    stencilBuffer: false,
  });
}

export class Bloom {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {object} opts { threshold, knee, strength, radius }
   */
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.enabled = true;
    // Exactly white, in linear light. This is not a taste setting - it is the
    // definition the rest of the design leans on: bloom is what happens to
    // things the display cannot represent, so only surfaces deliberately pushed
    // past 1 glow, and a merely bright surface never does.
    //
    // Set below 1 it looked fine on the two night themes and destroyed the two
    // daylight ones: a 0.9-white sky crossed the threshold and the whole horizon
    // bloomed into a wall of haze.
    this.threshold = opts.threshold ?? 1.0;
    this.knee = opts.knee ?? 0.45;
    this.strength = opts.strength ?? 0.85;
    /** Blur reach, in half-res texels. */
    this.radius = opts.radius ?? 1.6;

    // Half-float lets a surface be brighter than white and bloom by how much it
    // overshoots. In an 8-bit target everything above 1 clamps flat, so the
    // brightest things all glow identically - degraded, but a picture. A device
    // that cannot render half-float at all gets that degraded version rather
    // than an incomplete framebuffer and a black screen.
    this.hdr = canRenderHalfFloat(renderer);
    const type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;

    // Every target stays in linear light. Bloom is a simulation of light
    // spilling, and light adds linearly - blurring display-encoded values
    // spreads the wrong amount of it. The single conversion to sRGB happens in
    // the composite shader, on the last write before the canvas.
    this.sceneTarget = makeTarget(1, 1, type);
    this.brightTarget = makeTarget(1, 1, type);
    this.blurA = makeTarget(1, 1, type);
    this.blurB = makeTarget(1, 1, type);

    this.brightMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: this.threshold },
        knee: { value: this.knee },
      },
      vertexShader: VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        direction: { value: new THREE.Vector2() },
      },
      vertexShader: VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        strength: { value: this.strength },
      },
      vertexShader: VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    // One quad and one ortho camera reused by every pass. The camera's numbers
    // never matter - the vertex shader ignores them - but three needs one.
    this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.brightMaterial);
    this._quad.frustumCulled = false;
    this._quadScene = new THREE.Scene();
    this._quadScene.add(this._quad);
    this._quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this._width = 0;
    this._height = 0;
  }

  setSize(width, height) {
    if (width === this._width && height === this._height) return;
    this._width = width;
    this._height = height;
    const dpr = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    const hw = Math.max(1, Math.round(w / DOWNSCALE));
    const hh = Math.max(1, Math.round(h / DOWNSCALE));

    this.sceneTarget.setSize(w, h);
    this.brightTarget.setSize(hw, hh);
    this.blurA.setSize(hw, hh);
    this.blurB.setSize(hw, hh);
    this._halfW = hw;
    this._halfH = hh;
  }

  /** Runs one pass of `material` into `target` (null meaning the canvas). */
  _pass(material, target) {
    this._quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this._quadScene, this._quadCamera);
  }

  /**
   * Draws the scene with bloom applied.
   *
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  render(scene, camera) {
    const r = this.renderer;

    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }

    r.setRenderTarget(this.sceneTarget);
    r.clear();
    r.render(scene, camera);

    this.brightMaterial.uniforms.tDiffuse.value = this.sceneTarget.texture;
    this.brightMaterial.uniforms.threshold.value = this.threshold;
    this.brightMaterial.uniforms.knee.value = this.knee;
    this._pass(this.brightMaterial, this.brightTarget);

    const dir = this.blurMaterial.uniforms.direction.value;

    this.blurMaterial.uniforms.tDiffuse.value = this.brightTarget.texture;
    dir.set(this.radius / this._halfW, 0);
    this._pass(this.blurMaterial, this.blurA);

    this.blurMaterial.uniforms.tDiffuse.value = this.blurA.texture;
    dir.set(0, this.radius / this._halfH);
    this._pass(this.blurMaterial, this.blurB);

    this.compositeMaterial.uniforms.tScene.value = this.sceneTarget.texture;
    this.compositeMaterial.uniforms.tBloom.value = this.blurB.texture;
    this.compositeMaterial.uniforms.strength.value = this.strength;
    this._pass(this.compositeMaterial, null);
  }

  dispose() {
    this.sceneTarget.dispose();
    this.brightTarget.dispose();
    this.blurA.dispose();
    this.blurB.dispose();
    this.brightMaterial.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
    this._quad.geometry.dispose();
  }
}
