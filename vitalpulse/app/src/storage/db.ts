import * as SQLite from 'expo-sqlite';
import { BloodPressureReading, DEFAULT_SETTINGS, PulseReading, Settings } from '../types';

/**
 * Everything lives in a single on-device SQLite file. There is no server, no
 * account, and no sync — nothing in this file ever makes a network call.
 */
const DB_NAME = 'vitalpulse.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS pulse_readings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          taken_at TEXT NOT NULL,
          bpm INTEGER NOT NULL,
          hrv_rmssd_ms REAL,
          signal_quality TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bp_readings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          taken_at TEXT NOT NULL,
          systolic INTEGER NOT NULL,
          diastolic INTEGER NOT NULL,
          pulse_bpm INTEGER
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function insertPulseReading(
  reading: Omit<PulseReading, 'id'>
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pulse_readings (taken_at, bpm, hrv_rmssd_ms, signal_quality) VALUES (?, ?, ?, ?);`,
    reading.takenAt,
    reading.bpm,
    reading.hrvRmssdMs,
    reading.signalQuality
  );
}

export async function insertBPReading(
  reading: Omit<BloodPressureReading, 'id'>
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO bp_readings (taken_at, systolic, diastolic, pulse_bpm) VALUES (?, ?, ?, ?);`,
    reading.takenAt,
    reading.systolic,
    reading.diastolic,
    reading.pulseBpm
  );
}

export async function getRecentPulseReadings(limit = 90): Promise<PulseReading[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT id, taken_at as takenAt, bpm, hrv_rmssd_ms as hrvRmssdMs, signal_quality as signalQuality
     FROM pulse_readings ORDER BY taken_at DESC LIMIT ?;`,
    limit
  );
  return rows;
}

export async function getRecentBPReadings(limit = 90): Promise<BloodPressureReading[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT id, taken_at as takenAt, systolic, diastolic, pulse_bpm as pulseBpm
     FROM bp_readings ORDER BY taken_at DESC LIMIT ?;`,
    limit
  );
  return rows;
}

export async function deleteAllData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM pulse_readings;
    DELETE FROM bp_readings;
  `);
}

export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings;`
  );
  const stored: Record<string, string> = {};
  for (const row of rows) stored[row.key] = row.value;
  if (Object.keys(stored).length === 0) return DEFAULT_SETTINGS;
  return {
    textScaleIndex: Number(stored.textScaleIndex ?? DEFAULT_SETTINGS.textScaleIndex),
    highContrast: stored.highContrast === 'true',
    reminderEnabled: stored.reminderEnabled === 'true',
    reminderHour: Number(stored.reminderHour ?? DEFAULT_SETTINGS.reminderHour),
    reminderMinute: Number(stored.reminderMinute ?? DEFAULT_SETTINGS.reminderMinute),
    leftHandCameraMode: stored.leftHandCameraMode === 'true',
    onboardingComplete: stored.onboardingComplete === 'true',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  const entries = Object.entries(settings);
  for (const [key, value] of entries) {
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      key,
      String(value)
    );
  }
}

/** Plain-text CSV export — the format a person can actually open and hand to a doctor. */
export async function exportAllAsCsv(): Promise<string> {
  const [pulses, bps] = await Promise.all([
    getRecentPulseReadings(100000),
    getRecentBPReadings(100000),
  ]);
  const lines = ['type,taken_at,systolic,diastolic,bpm,hrv_rmssd_ms,signal_quality'];
  for (const r of bps) {
    lines.push(`blood_pressure,${r.takenAt},${r.systolic},${r.diastolic},${r.pulseBpm ?? ''},,`);
  }
  for (const r of pulses) {
    lines.push(`pulse_check,${r.takenAt},,,${r.bpm},${r.hrvRmssdMs ?? ''},${r.signalQuality}`);
  }
  return lines.join('\n');
}
