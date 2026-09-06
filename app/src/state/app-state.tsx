import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { DATA_LANGS } from '@/db/bundles.generated';
import { getUserDb, kvGet, kvSet, openDatabases, openUserDb } from '@/db/database';
import type { Kind } from '@/db/types';
import { STRINGS, type Strings, type UiLang, UI_LANGS } from '@/i18n/strings';

interface BookmarkRow { kind: Kind; id: number; added_at: number }

interface AppState {
  ready: boolean;
  error: string | null;
  progress: string;
  uiLang: UiLang;
  dataLang: string;
  t: Strings;
  setUiLang: (l: UiLang) => void;
  setDataLang: (l: string) => Promise<void>;
  bookmarks: BookmarkRow[];
  isBookmarked: (kind: Kind, id: number) => boolean;
  toggleBookmark: (kind: Kind, id: number) => Promise<void>;
  history: BookmarkRow[];
  recordVisit: (kind: Kind, id: number) => Promise<void>;
  /** Increments whenever the data database changes (language switch) so screens can reload. */
  dataVersion: number;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [uiLang, setUiLangState] = useState<UiLang>('uk');
  const [dataLang, setDataLangState] = useState<string>(DATA_LANGS[0] ?? 'ru');
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [history, setHistory] = useState<BookmarkRow[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const started = useRef(false);

  const loadUserLists = useCallback(async () => {
    const db = getUserDb();
    setBookmarks(await db.getAllAsync<BookmarkRow>('SELECT kind, id, added_at FROM bookmarks ORDER BY added_at DESC'));
    setHistory(await db.getAllAsync<BookmarkRow>('SELECT kind, id, seen_at AS added_at FROM history ORDER BY seen_at DESC LIMIT 50'));
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        await openUserDb();
        const savedUi = (await kvGet('uiLang')) as UiLang | null;
        const savedData = await kvGet('dataLang');
        const ui = savedUi && UI_LANGS.includes(savedUi) ? savedUi : 'uk';
        const data = savedData && DATA_LANGS.includes(savedData) ? savedData : (DATA_LANGS[0] ?? 'ru');
        setUiLangState(ui);
        setDataLangState(data);
        await openDatabases(data, (_step, msg) => setProgress(msg));
        await loadUserLists();
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [loadUserLists]);

  const setUiLang = useCallback((l: UiLang) => {
    setUiLangState(l);
    kvSet('uiLang', l).catch(() => {});
  }, []);

  const setDataLang = useCallback(async (l: string) => {
    if (!DATA_LANGS.includes(l) || l === dataLang) return;
    setReady(false);
    try {
      await openDatabases(l, (_s, msg) => setProgress(msg));
      setDataLangState(l);
      await kvSet('dataLang', l);
      setDataVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReady(true);
    }
  }, [dataLang]);

  const isBookmarked = useCallback((kind: Kind, id: number) => bookmarks.some((b) => b.kind === kind && b.id === id), [bookmarks]);

  const toggleBookmark = useCallback(async (kind: Kind, id: number) => {
    const db = getUserDb();
    if (bookmarks.some((b) => b.kind === kind && b.id === id)) {
      await db.runAsync('DELETE FROM bookmarks WHERE kind = ? AND id = ?', kind, id);
    } else {
      await db.runAsync('INSERT OR REPLACE INTO bookmarks (kind, id, added_at) VALUES (?, ?, ?)', kind, id, Date.now());
    }
    await loadUserLists();
  }, [bookmarks, loadUserLists]);

  const recordVisit = useCallback(async (kind: Kind, id: number) => {
    const db = getUserDb();
    await db.runAsync('INSERT OR REPLACE INTO history (kind, id, seen_at) VALUES (?, ?, ?)', kind, id, Date.now());
    await db.runAsync('DELETE FROM history WHERE (kind, id) NOT IN (SELECT kind, id FROM history ORDER BY seen_at DESC LIMIT 100)');
    setHistory(await db.getAllAsync<BookmarkRow>('SELECT kind, id, seen_at AS added_at FROM history ORDER BY seen_at DESC LIMIT 50'));
  }, []);

  const value = useMemo<AppState>(() => ({
    ready, error, progress, uiLang, dataLang, t: STRINGS[uiLang], setUiLang, setDataLang,
    bookmarks, isBookmarked, toggleBookmark, history, recordVisit, dataVersion,
  }), [ready, error, progress, uiLang, dataLang, setUiLang, setDataLang, bookmarks, isBookmarked, toggleBookmark, history, recordVisit, dataVersion]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}

export function useT(): Strings {
  return useApp().t;
}
