/**
 * The twelve levels.
 *
 * A level is data: theme, a fixed seed, a speed curve, an authored intro, a
 * seeded-procedural tail, and a roster. The seed is content, not a detail - the
 * same seed always produces the same course, so a seed that plays well is worth
 * keeping and naming.
 *
 * Target times come from actually racing each level headlessly (see
 * `tools/tune.mjs`), not from guessing. `targets` is the measured reference run
 * put through `targetsFor` - gold is the reference itself, silver 15% slower,
 * bronze 35%. Authoring the three numbers rather than the one ratio keeps the
 * medal a player is chasing stable even if the ratios are ever retuned; re-run
 * the tool after a physics change and paste the new block.
 */

/** Difficulty curves, as functions of progress through the tail. */
const CURVES = {
  gentle: (t) => 0.6 + t * 1.6,
  standard: (t) => 1 + t * 2,
  steep: (t) => 1.4 + t * 2.4,
  brutal: (t) => 2.2 + t * 1.8,
};

const ROSTERS = {
  easy: [
    { name: 'Sable', skill: 'easy' },
    { name: 'Pike', skill: 'easy' },
    { name: 'Juno', skill: 'normal' },
  ],
  mixed: [
    { name: 'Vex', skill: 'normal' },
    { name: 'Juno', skill: 'normal' },
    { name: 'Pike', skill: 'easy' },
    { name: 'Sable', skill: 'easy' },
  ],
  tough: [
    { name: 'Vex', skill: 'hard' },
    { name: 'Rell', skill: 'hard' },
    { name: 'Juno', skill: 'normal' },
    { name: 'Pike', skill: 'normal' },
    { name: 'Sable', skill: 'easy' },
  ],
};

/**
 * @typedef {object} LevelDef
 * @property {string} id
 * @property {string} name
 * @property {string} theme
 * @property {number} seed          fixed; the seed is content
 * @property {number} tailChunks    how much procedural course follows the intro
 * @property {object} speedCurve
 * @property {object[]} roster
 * @property {number} unlockAt      player level required
 */
export const LEVELS = [
  {
    id: 'level-01', name: 'First Light', theme: 'rooftops', seed: 1041,
    intro: ['run-neutral', 'vault-single', 'run-coins-weave', 'slide-single'],
    tailChunks: 5, outro: ['run-neutral'],
    difficultyCurve: CURVES.gentle,
    speedCurve: { start: 9, base: 12, max: 15, accelPerSec: 0.2 },
    targets: { gold: 18.1, silver: 20.8, bronze: 24.5 }, // reference 18.12 s
    roster: ROSTERS.easy, unlockAt: 0,
  },
  {
    id: 'level-02', name: 'Ledger Line', theme: 'rooftops', seed: 2207,
    intro: ['run-neutral', 'vault-stagger', 'slide-single', 'gap-single'],
    tailChunks: 6, outro: ['run-neutral'],
    difficultyCurve: CURVES.gentle,
    speedCurve: { start: 9, base: 13, max: 16, accelPerSec: 0.22 },
    targets: { gold: 19.6, silver: 22.5, bronze: 26.4 }, // reference 19.55 s
    roster: ROSTERS.easy, unlockAt: 0,
  },
  {
    id: 'level-03', name: 'Long Fall', theme: 'rooftops', seed: 3313,
    intro: ['run-neutral', 'gap-single', 'vault-stagger', 'step-up-mantle', 'ramp-down'],
    tailChunks: 7, outro: ['run-neutral'],
    difficultyCurve: CURVES.standard,
    speedCurve: { start: 10, base: 14, max: 17, accelPerSec: 0.24 },
    targets: { gold: 23.6, silver: 27.2, bronze: 31.9 }, // reference 23.62 s
    roster: ROSTERS.mixed, unlockAt: 2,
  },
  {
    id: 'level-04', name: 'Undertow', theme: 'undercity', seed: 4127,
    intro: ['run-neutral', 'slide-single', 'slide-tunnel', 'vault-single'],
    tailChunks: 7, outro: ['run-neutral'],
    difficultyCurve: CURVES.standard,
    speedCurve: { start: 10, base: 14, max: 18, accelPerSec: 0.24 },
    targets: { gold: 20.5, silver: 23.6, bronze: 27.7 }, // reference 20.48 s
    roster: ROSTERS.mixed, unlockAt: 3,
  },
  {
    id: 'level-05', name: 'Shutter Row', theme: 'undercity', seed: 5501,
    intro: ['run-neutral', 'wallrun-ledge', 'vault-stagger', 'slide-single'],
    tailChunks: 8, outro: ['run-neutral'],
    difficultyCurve: CURVES.standard,
    speedCurve: { start: 10, base: 15, max: 18, accelPerSec: 0.25 },
    targets: { gold: 20.3, silver: 23.4, bronze: 27.5 }, // reference 20.33 s
    roster: ROSTERS.mixed, unlockAt: 5,
  },
  {
    id: 'level-06', name: 'Deep Cut', theme: 'undercity', seed: 6619,
    intro: ['run-neutral', 'gap-double', 'wallrun-ledge', 'mix-vault-slide'],
    tailChunks: 8, outro: ['run-neutral'],
    difficultyCurve: CURVES.steep,
    speedCurve: { start: 11, base: 15, max: 19, accelPerSec: 0.26 },
    targets: { gold: 19.6, silver: 22.5, bronze: 26.4 }, // reference 19.55 s
    roster: ROSTERS.mixed, unlockAt: 7,
  },
  {
    id: 'level-07', name: 'Kiln', theme: 'solarworks', seed: 7717,
    intro: ['run-neutral', 'launch-hop', 'vault-stagger', 'gap-single'],
    tailChunks: 9, outro: ['run-neutral'],
    difficultyCurve: CURVES.steep,
    speedCurve: { start: 11, base: 16, max: 19, accelPerSec: 0.26 },
    targets: { gold: 23.2, silver: 26.7, bronze: 31.3 }, // reference 23.22 s
    roster: ROSTERS.tough, unlockAt: 9,
  },
  {
    id: 'level-08', name: 'Slipstream', theme: 'solarworks', seed: 8831,
    intro: ['run-neutral', 'speed-strip', 'gap-double', 'mix-vault-slide'],
    tailChunks: 9, outro: ['run-neutral'],
    difficultyCurve: CURVES.steep,
    speedCurve: { start: 12, base: 16, max: 20, accelPerSec: 0.28 },
    targets: { gold: 20.9, silver: 24.1, bronze: 28.2 }, // reference 20.92 s
    roster: ROSTERS.tough, unlockAt: 11,
  },
  {
    id: 'level-09', name: 'Anvil', theme: 'solarworks', seed: 9907,
    intro: ['run-neutral', 'mix-vault-slide', 'wallrun-ledge', 'gap-double'],
    tailChunks: 10, outro: ['run-neutral'],
    difficultyCurve: CURVES.brutal,
    speedCurve: { start: 12, base: 17, max: 20, accelPerSec: 0.28 },
    targets: { gold: 23.5, silver: 27.1, bronze: 31.8 }, // reference 23.55 s
    roster: ROSTERS.tough, unlockAt: 13,
  },
  {
    id: 'level-10', name: 'Whiteout', theme: 'frostline', seed: 11003,
    intro: ['run-neutral', 'slide-tunnel', 'gap-double', 'wallrun-ledge'],
    tailChunks: 10, outro: ['run-neutral'],
    difficultyCurve: CURVES.brutal,
    speedCurve: { start: 12, base: 17, max: 21, accelPerSec: 0.3 },
    targets: { gold: 23.2, silver: 26.7, bronze: 31.4 }, // reference 23.23 s
    roster: ROSTERS.tough, unlockAt: 15,
  },
  {
    id: 'level-11', name: 'Cold Open', theme: 'frostline', seed: 12119,
    intro: ['run-neutral', 'launch-hop', 'wallrun-ledge', 'gap-double', 'mix-vault-slide'],
    tailChunks: 11, outro: ['run-neutral'],
    difficultyCurve: CURVES.brutal,
    speedCurve: { start: 13, base: 18, max: 21, accelPerSec: 0.3 },
    targets: { gold: 26.9, silver: 30.9, bronze: 36.3 }, // reference 26.87 s
    roster: ROSTERS.tough, unlockAt: 18,
  },
  {
    id: 'level-12', name: 'Vertigo', theme: 'frostline', seed: 13229,
    intro: ['run-neutral', 'gap-double', 'slide-tunnel', 'wallrun-ledge', 'mix-vault-slide'],
    tailChunks: 12, outro: ['run-neutral'],
    difficultyCurve: CURVES.brutal,
    speedCurve: { start: 13, base: 18, max: 22, accelPerSec: 0.32 },
    targets: { gold: 26.4, silver: 30.3, bronze: 35.6 }, // reference 26.37 s
    roster: ROSTERS.tough, unlockAt: 21,
  },
];

export const LEVELS_BY_ID = (() => {
  const out = Object.create(null);
  for (const l of LEVELS) out[l.id] = l;
  return out;
})();

export function levelDef(id) {
  return LEVELS_BY_ID[id] || LEVELS[0];
}

export { CURVES, ROSTERS };
