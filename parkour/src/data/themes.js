/**
 * Theme palettes.
 *
 * Pure data - colours are plain 0xRRGGBB integers, not three.js Colors, so this
 * file stays importable from Node and from the level validator. The renderer
 * turns them into materials.
 *
 * There are no textures anywhere in this game: every surface is flat-shaded with
 * vertex colours, so a theme is genuinely just this table.
 */

/** @typedef {keyof typeof THEMES} ThemeId */

export const THEMES = {
  rooftops: {
    name: 'Rooftops',
    /** Scales every emissive surface: bright noon - paint should read as paint, not neon. */
    glow: 0.18,
    sky: 0x5fb8ea,
    fog: 0x8ed0f2,
    fogNear: 90,
    fogFar: 320,
    hemiSky: 0xeaf6ff,
    hemiGround: 0x9db6c8,
    sunColor: 0xfff6e8,
    sunIntensity: 1.25,
    /** Indexed by SURFACE: concrete, metal, wood, glass, grate. */
    surfaces: [0xf0f2f5, 0xdde4ea, 0xe6cba6, 0xc2e4f4, 0xd6dde4],
    accent: 0xff8c2a,
    hazard: 0xff5038,
    vault: 0xff7a30,
    wall: 0xe9edf1,
    rail: 0xff8c3a,
    /** Track markings - edge stripes and the centre dot trail. */
    mark: 0xffffff,
    /** Flat mid-blue skyline silhouette against the saturated sky. */
    decor: [0x4795cc, 0x3f88be, 0x54a4d8],
  },

  undercity: {
    name: 'Undercity',
    /** Scales every emissive surface: underground and lit only by what glows. */
    glow: 1.25,
    sky: 0x1a1432,
    fog: 0x261e40,
    fogNear: 45,
    fogFar: 200,
    hemiSky: 0x8a74ff,
    hemiGround: 0x1c1630,
    sunColor: 0xd9c6ff,
    sunIntensity: 1.0,
    surfaces: [0x3d3550, 0x5c5470, 0x53412f, 0x4a6f8a, 0x332c44],
    accent: 0x38e8c8,
    hazard: 0xff2d6f,
    vault: 0x9d6cff,
    wall: 0x2b2440,
    rail: 0x38e8c8,
    mark: 0x5ff0d8,
    decor: [0x241d36, 0x1c1729, 0x3a3054],
  },

  solarworks: {
    name: 'Solarworks',
    /** Scales every emissive surface: high sun; glowing paint would read as blown-out, not lit. */
    glow: 0.3,
    sky: 0xf2b46a,
    fog: 0xe8a86a,
    fogNear: 80,
    fogFar: 300,
    hemiSky: 0xffd9a0,
    hemiGround: 0x6b4326,
    sunColor: 0xfff4e0,
    sunIntensity: 1.4,
    surfaces: [0xc9a077, 0xd8c2a0, 0xa87346, 0xe0d0b0, 0xb08c62],
    accent: 0x2f6fd0,
    hazard: 0xd42a1f,
    vault: 0x3f8ae0,
    wall: 0xb08a5e,
    rail: 0xfff0d0,
    mark: 0xfff6e0,
    decor: [0xb5905f, 0x9a7748, 0xd0aa78],
  },

  frostline: {
    name: 'Frostline',
    /** Scales every emissive surface: snow at noon is already the brightest thing on screen. */
    glow: 0.25,
    sky: 0xcfe6f5,
    fog: 0xdcecf7,
    fogNear: 60,
    fogFar: 240,
    hemiSky: 0xffffff,
    hemiGround: 0x9ab4c8,
    sunColor: 0xf0f8ff,
    sunIntensity: 1.25,
    surfaces: [0xa8bdcc, 0xc4d4e0, 0x8a7b6a, 0xd8ecf8, 0x93a8b8],
    accent: 0x1f7ac4,
    hazard: 0xe03050,
    vault: 0x2f9ad8,
    wall: 0x8fa6b8,
    rail: 0xffffff,
    mark: 0xffffff,
    decor: [0x93aabc, 0x7e94a6, 0xb4c8d6],
  },
};

export const THEME_IDS = Object.keys(THEMES);

export function getTheme(id) {
  return THEMES[id] || THEMES.rooftops;
}
