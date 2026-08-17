/**
 * The save file's shape, and how to get any older one into it.
 *
 * Save data outlives the code that wrote it. A player who has been racing for
 * weeks must not lose their unlocks because a field was renamed, so every load
 * runs through `migrate`, and every unknown or corrupt file degrades to a fresh
 * profile rather than throwing.
 *
 * Pure: no storage, no clock. The adapter is injected by SaveManager.
 */
import { PROGRESSION } from '../../config.js';
import { TUTORIAL_IDS } from '../../data/tutorial.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'vertigo-rush.save.v1';

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    /** Total currency held. */
    coins: 0,
    xp: 0,
    playerLevel: 1,
    characterId: 'runner-ember',
    unlockedCharacters: ['runner-ember', 'runner-tangerine'],
    /** Per level: { bestTime, bestPlacement, coins, medal, runs, finished }. */
    levels: {},
    settings: {
      haptics: true,
      audio: true,
      reducedMotion: false,
      qualityTier: null,
      tutorialHints: true,
    },
    /**
     * Which first-run hints have been shown, keyed by hint id.
     *
     * A map rather than a count or a bitfield: hints get added and reworded
     * over a game's life, and a player who has seen four of five should not be
     * shown the four again because a fifth was written.
     */
    tutorialSeen: {},
    stats: {
      races: 0,
      finishes: 0,
      wins: 0,
      deaths: 0,
      distance: 0,
    },
  };
}

export function defaultLevelRecord() {
  return {
    bestTime: null,
    bestPlacement: null,
    coins: 0,
    medal: null,
    runs: 0,
    finished: false,
  };
}

/** XP needed to reach `level` from level 1. */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(PROGRESSION.xpCurveBase * (level - 1) ** PROGRESSION.xpCurveExponent);
}

/** Player level implied by a total XP figure. */
export function levelForXp(xp) {
  let level = 1;
  while (level < PROGRESSION.maxPlayerLevel && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/**
 * Brings any save forward to the current version.
 *
 * Unknown shapes, wrong types and future versions all resolve to a usable
 * profile. Losing a save is worse than losing a field.
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultSave();

  const base = defaultSave();
  const version = Number.isInteger(raw.version) ? raw.version : 0;

  // A save from a future build cannot be interpreted safely - keep only the
  // things whose meaning is stable, and rebuild the rest.
  if (version > SAVE_VERSION) {
    return {
      ...base,
      coins: num(raw.coins, 0),
      xp: num(raw.xp, 0),
      playerLevel: levelForXp(num(raw.xp, 0)),
    };
  }

  const out = {
    ...base,
    coins: num(raw.coins, 0),
    xp: num(raw.xp, 0),
    characterId: typeof raw.characterId === 'string' ? raw.characterId : base.characterId,
    unlockedCharacters: Array.isArray(raw.unlockedCharacters) && raw.unlockedCharacters.length
      ? raw.unlockedCharacters.filter((c) => typeof c === 'string')
      : base.unlockedCharacters,
    settings: { ...base.settings, ...objectOr(raw.settings) },
    stats: { ...base.stats, ...numericFields(raw.stats, base.stats) },
    // A save written before the tutorial existed has no `tutorialSeen` at all,
    // and `seenFlags` turns that into an empty map - so an existing player is
    // shown the hints once, rather than never. That is the right way round:
    // being taught a move you already know costs two seconds, and never being
    // taught one costs the race.
    tutorialSeen: seenFlags(raw.tutorialSeen),
    levels: {},
  };

  const levels = objectOr(raw.levels);
  for (const id of Object.keys(levels)) {
    const rec = objectOr(levels[id]);
    out.levels[id] = {
      ...defaultLevelRecord(),
      bestTime: positiveOrNull(rec.bestTime),
      bestPlacement: positiveOrNull(rec.bestPlacement),
      coins: num(rec.coins, 0),
      medal: typeof rec.medal === 'string' ? rec.medal : null,
      runs: num(rec.runs, 0),
      finished: rec.finished === true,
    };
  }

  // Derived rather than trusted: a hand-edited file cannot grant a level.
  out.playerLevel = levelForXp(out.xp);
  return out;
}

/**
 * Keeps only known hint ids, and only where the value is exactly `true`.
 *
 * Filtering against the current id list means a hint removed from the game
 * stops taking up room in every save file that mentions it, and a hand-edited
 * file cannot grow the map without bound.
 */
function seenFlags(raw) {
  const src = objectOr(raw);
  const out = {};
  for (const id of TUTORIAL_IDS) if (src[id] === true) out[id] = true;
  return out;
}

function num(v, fallback) {
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function positiveOrNull(v) {
  return Number.isFinite(v) && v > 0 ? v : null;
}

function objectOr(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function numericFields(raw, template) {
  const src = objectOr(raw);
  const out = {};
  for (const key of Object.keys(template)) out[key] = num(src[key], template[key]);
  return out;
}
