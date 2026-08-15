/**
 * Progress, and keeping it.
 *
 * The storage adapter is injected rather than imported, so this file never
 * mentions localStorage and stays inside the purity rule. That is not a
 * technicality: it is what lets save/load be tested against a full-quota
 * adapter, a corrupt-JSON adapter and a throwing adapter without a browser.
 *
 * Every write is defensive. A player who has been racing for weeks should lose
 * a session at worst, never a profile.
 */
import { PROGRESSION, RACE } from '../../config.js';
import {
  SAVE_KEY, defaultSave, defaultLevelRecord, migrate, levelForXp, xpForLevel,
} from './schema.js';

/**
 * An in-process storage adapter - the default, and the test double.
 *
 * Same (key, value) shape as the localStorage adapter, so anything that works
 * against one works against the other.
 */
export function memoryAdapter(initial = null) {
  let value = initial;
  return {
    read: () => value,
    write: (_key, v) => { value = v; },
    remove: () => { value = null; },
  };
}

export class SaveManager {
  /**
   * @param {{read: Function, write: Function, remove: Function}} adapter
   */
  constructor(adapter = memoryAdapter(), opts = {}) {
    this.adapter = adapter;
    this.key = opts.key || SAVE_KEY;
    this.data = defaultSave();
    /** Set when the last load had to fall back - the UI can mention it. */
    this.recovered = false;
    /** Set when a write failed, so the UI can stop promising persistence. */
    this.writeFailed = false;
  }

  load() {
    this.recovered = false;
    let raw = null;
    try {
      raw = this.adapter.read(this.key);
    } catch {
      // A storage read can throw outright in private-browsing modes.
      this.recovered = true;
      this.data = defaultSave();
      return this.data;
    }

    if (raw === null || raw === undefined || raw === '') {
      this.data = defaultSave();
      return this.data;
    }

    let parsed = null;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      // Corrupt JSON: a truncated write, or something else using the key.
      this.recovered = true;
      this.data = defaultSave();
      return this.data;
    }

    const before = JSON.stringify(parsed);
    this.data = migrate(parsed);
    if (JSON.stringify(this.data) !== before) this.recovered = true;
    return this.data;
  }

  save() {
    try {
      this.adapter.write(this.key, JSON.stringify(this.data));
      this.writeFailed = false;
      return true;
    } catch {
      // Quota exceeded, or storage disabled. The session continues; only
      // persistence is lost, and the caller is told so it can say so.
      this.writeFailed = true;
      return false;
    }
  }

  reset() {
    this.data = defaultSave();
    try {
      this.adapter.remove(this.key);
    } catch { /* nothing to do - the in-memory profile is already fresh */ }
    return this.data;
  }

  levelRecord(levelId) {
    if (!this.data.levels[levelId]) {
      this.data.levels[levelId] = defaultLevelRecord();
    }
    return this.data.levels[levelId];
  }

  /** Best time on a level, or null if it has never been finished. */
  bestTime(levelId) {
    return this.levelRecord(levelId).bestTime;
  }

  isUnlocked(levelDef) {
    return this.data.playerLevel >= (levelDef.unlockAt ?? 0)
      || (levelDef.unlockAt ?? 0) === 0;
  }

  /**
   * Folds one finished race into the profile.
   *
   * @param {string} levelId
   * @param {object} result  { placement, time, dnf, coins, deaths, distance }
   * @param {object} [targets] { gold, silver, bronze } target times
   * @returns a summary of what changed, for the rewards screen
   */
  recordRace(levelId, result, targets = null) {
    const rec = this.levelRecord(levelId);
    const stats = this.data.stats;

    rec.runs++;
    stats.races++;
    stats.deaths += result.deaths || 0;
    stats.distance += result.distance || 0;

    const finished = !result.dnf && Number.isFinite(result.time);
    const placement = result.placement || 0;

    if (finished) {
      stats.finishes++;
      if (placement === 1) stats.wins++;
      rec.finished = true;
    }

    const improvedTime = finished && (rec.bestTime === null || result.time < rec.bestTime);
    if (improvedTime) rec.bestTime = result.time;

    const improvedPlace = finished && placement > 0
      && (rec.bestPlacement === null || placement < rec.bestPlacement);
    if (improvedPlace) rec.bestPlacement = placement;

    const medal = finished && targets ? medalFor(result.time, targets) : null;
    const improvedMedal = medal && medalRank(medal) > medalRank(rec.medal);
    if (improvedMedal) rec.medal = medal;

    // Coins earned are kept per level for display, and added to the wallet once.
    const coinsEarned = (result.coins || 0)
      + (finished ? placementCoins(placement) : 0);
    rec.coins = Math.max(rec.coins, result.coins || 0);
    this.data.coins += coinsEarned;

    const xpEarned = (finished ? PROGRESSION.xpFinishBonus : 0)
      + placementXp(placement)
      + (result.coins || 0) * PROGRESSION.xpPerCoin;

    const levelBefore = this.data.playerLevel;
    this.data.xp += xpEarned;
    this.data.playerLevel = levelForXp(this.data.xp);

    this.save();

    return {
      finished,
      placement,
      time: finished ? result.time : null,
      improvedTime,
      improvedPlace,
      medal,
      improvedMedal,
      coinsEarned,
      xpEarned,
      levelBefore,
      levelAfter: this.data.playerLevel,
      levelledUp: this.data.playerLevel > levelBefore,
      xpToNext: Math.max(0, xpForLevel(this.data.playerLevel + 1) - this.data.xp),
      persisted: !this.writeFailed,
    };
  }

  /** Spends currency. Rejects an overspend rather than going negative. */
  spend(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if (this.data.coins < amount) return false;
    this.data.coins -= amount;
    this.save();
    return true;
  }

  unlockCharacter(id, cost = 0) {
    if (this.data.unlockedCharacters.includes(id)) return false;
    if (cost > 0 && !this.spend(cost)) return false;
    this.data.unlockedCharacters.push(id);
    this.save();
    return true;
  }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.save();
    return value;
  }
}

/**
 * Target times for a level, derived from a measured reference time.
 *
 * Deriving them from one measurement rather than writing three numbers per
 * level means a physics retune shifts all thirty-six targets consistently.
 */
export function targetsFor(referenceTime) {
  return {
    gold: referenceTime * 1.0,
    silver: referenceTime * 1.15,
    bronze: referenceTime * 1.35,
  };
}

export function medalFor(time, targets) {
  if (!Number.isFinite(time) || !targets) return null;
  if (time <= targets.gold) return 'gold';
  if (time <= targets.silver) return 'silver';
  if (time <= targets.bronze) return 'bronze';
  return null;
}

function medalRank(medal) {
  return medal === 'gold' ? 3 : medal === 'silver' ? 2 : medal === 'bronze' ? 1 : 0;
}

function placementXp(placement) {
  const table = PROGRESSION.xpPerPlacement;
  if (placement < 1) return 0;
  return table[Math.min(placement, table.length) - 1];
}

function placementCoins(placement) {
  const table = PROGRESSION.coinsPerPlacement;
  if (placement < 1) return 0;
  return table[Math.min(placement, table.length) - 1];
}

export { RACE };
