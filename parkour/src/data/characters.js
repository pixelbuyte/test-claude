/**
 * The playable characters.
 *
 * Every character shares the one rig, so a character is a palette plus a name
 * plus what it costs. That is the scope note honoured deliberately: outfits are
 * palette swaps, because a second skeleton would mean a second set of sixteen
 * clips to keep correct for no gameplay difference.
 *
 * Pure data - no three.js Colors, just 0xRRGGBB integers.
 */

/**
 * @typedef {object} Character
 * @property {string} id
 * @property {string} name
 * @property {string} blurb      one line, shown on the picker
 * @property {number} primary    torso and thighs
 * @property {number} accent     limbs, hips, feet
 * @property {number} skin       head and forearms
 * @property {number} cost       coins; 0 means owned from the start
 * @property {number} unlockAt   player level required before it can be bought
 */
export const CHARACTERS = [
  {
    id: 'runner-ember',
    name: 'Ember',
    blurb: 'The one you start with.',
    primary: 0xff7a3d, accent: 0x2b3350, skin: 0xf0c8a0,
    cost: 0, unlockAt: 0,
  },
  {
    id: 'runner-tangerine',
    name: 'Tangerine',
    blurb: 'Straight off the reference sheet.',
    primary: 0xf79240, accent: 0xde4a32, skin: 0xf5983c,
    cost: 0, unlockAt: 0,
  },
  {
    id: 'runner-ash',
    name: 'Ash',
    blurb: 'Quiet colours, loud lines.',
    primary: 0x4a5468, accent: 0x1b2030, skin: 0xd9a978,
    cost: 250, unlockAt: 0,
  },
  {
    id: 'runner-vale',
    name: 'Vale',
    blurb: 'Built for the undercity.',
    primary: 0x38e8c8, accent: 0x14323a, skin: 0xe8c49a,
    cost: 500, unlockAt: 3,
  },
  {
    id: 'runner-kite',
    name: 'Kite',
    blurb: 'Bright enough to be seen falling.',
    primary: 0xffd85e, accent: 0x3a2f10, skin: 0xf2d3b0,
    cost: 750, unlockAt: 6,
  },
  {
    id: 'runner-onyx',
    name: 'Onyx',
    blurb: 'No reflections, no tells.',
    primary: 0x21242e, accent: 0x9d7bff, skin: 0xc79a72,
    cost: 1200, unlockAt: 10,
  },
  {
    id: 'runner-flare',
    name: 'Flare',
    blurb: 'For the frostline, out of spite.',
    primary: 0xff3b6b, accent: 0xffe0e8, skin: 0xf5d5b8,
    cost: 1800, unlockAt: 15,
  },
];

export const CHARACTERS_BY_ID = (() => {
  const out = Object.create(null);
  for (const c of CHARACTERS) out[c.id] = c;
  return out;
})();

export function character(id) {
  return CHARACTERS_BY_ID[id] || CHARACTERS[0];
}

/** Whether a character can be bought yet, and why not if it cannot. */
export function purchaseState(def, save) {
  if (save.data.unlockedCharacters.includes(def.id)) return { owned: true };
  if (save.data.playerLevel < def.unlockAt) {
    return { owned: false, locked: true, reason: `Level ${def.unlockAt}` };
  }
  if (save.data.coins < def.cost) {
    return { owned: false, affordable: false, reason: `${def.cost} coins` };
  }
  return { owned: false, affordable: true, reason: `${def.cost} coins` };
}
