import * as SQLite from 'expo-sqlite';

import { ASSETS_BUNDLE, DATA_BUNDLES, MANIFEST } from './bundles.generated';

/**
 * Three databases:
 *  - aion_<lang>.db : game data for one language (bundled, copied on first launch)
 *  - assets.db      : images (bundled, copied on first launch)
 *  - user.db        : settings + bookmarks (created on device)
 */
let dataDb: SQLite.SQLiteDatabase | null = null;
let assetsDb: SQLite.SQLiteDatabase | null = null;
let userDb: SQLite.SQLiteDatabase | null = null;
let currentLang: string | null = null;

export type ProgressFn = (step: 'assets' | 'data' | 'user', message: string) => void;

export function getDataDb(): SQLite.SQLiteDatabase {
  if (!dataDb) throw new Error('Data database is not open');
  return dataDb;
}
export function getAssetsDb(): SQLite.SQLiteDatabase {
  if (!assetsDb) throw new Error('Assets database is not open');
  return assetsDb;
}
export function getUserDb(): SQLite.SQLiteDatabase {
  if (!userDb) throw new Error('User database is not open');
  return userDb;
}
export function getCurrentLang() { return currentLang; }

export async function openUserDb() {
  if (userDb) return userDb;
  userDb = await SQLite.openDatabaseAsync('user.db');
  await userDb.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS bookmarks (kind TEXT NOT NULL, id INTEGER NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY (kind, id));
    CREATE TABLE IF NOT EXISTS history (kind TEXT NOT NULL, id INTEGER NOT NULL, seen_at INTEGER NOT NULL, PRIMARY KEY (kind, id));
  `);
  return userDb;
}

export async function kvGet(key: string): Promise<string | null> {
  const row = await (await openUserDb()).getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? row.value : null;
}
export async function kvSet(key: string, value: string) {
  await (await openUserDb()).runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
}

/** Copies a bundled database into the SQLite directory when it is missing or when the bundle changed. */
async function ensureBundled(name: string, assetId: number, manifestKey: string) {
  const expected = MANIFEST[manifestKey] ? JSON.stringify(MANIFEST[manifestKey]) : null;
  const installed = await kvGet(`installed:${name}`);
  const forceOverwrite = expected !== null && installed !== expected;
  await SQLite.importDatabaseFromAssetAsync(name, { assetId, forceOverwrite });
  if (expected !== null) await kvSet(`installed:${name}`, expected);
}

export async function openDatabases(lang: string, onProgress?: ProgressFn) {
  await openUserDb();
  onProgress?.('user', 'user db ready');
  if (!assetsDb) {
    onProgress?.('assets', 'installing images');
    await ensureBundled('assets.db', ASSETS_BUNDLE, 'assets');
    assetsDb = await SQLite.openDatabaseAsync('assets.db');
  }
  if (!DATA_BUNDLES[lang]) lang = Object.keys(DATA_BUNDLES)[0];
  if (dataDb && currentLang === lang) return;
  if (dataDb) { await dataDb.closeAsync(); dataDb = null; }
  onProgress?.('data', `installing data (${lang})`);
  await ensureBundled(`aion_${lang}.db`, DATA_BUNDLES[lang], lang);
  dataDb = await SQLite.openDatabaseAsync(`aion_${lang}.db`);
  currentLang = lang;
}
