import { useCallback, useEffect, useRef, useState } from 'react';

import { searchEntities } from '@/db/queries';
import type { EntitySummary, SearchParams } from '@/db/types';
import { useApp } from '@/state/app-state';

const PAGE = 40;

interface Page { key: string; items: EntitySummary[]; done: boolean }

/** Paginated, debounced entity list backed by the FTS index. */
export function useEntityList(params: Omit<SearchParams, 'limit' | 'offset'>, debounceMs = 250) {
  const { dataVersion } = useApp();
  const [page, setPage] = useState<Page>({ key: '', items: [], done: false });
  const seq = useRef(0);
  const key = JSON.stringify(params) + dataVersion;
  const loading = page.key !== key;

  useEffect(() => {
    const my = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const rows = await searchEntities({ ...params, limit: PAGE, offset: 0 });
        if (seq.current === my) setPage({ key, items: rows, done: rows.length < PAGE });
      } catch {
        if (seq.current === my) setPage({ key, items: [], done: true });
      }
    }, debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = useCallback(async () => {
    if (loading || page.done) return;
    const my = seq.current;
    const rows = await searchEntities({ ...params, limit: PAGE, offset: page.items.length });
    if (seq.current !== my) return;
    setPage((prev) => (prev.key === key ? { key, items: [...prev.items, ...rows], done: rows.length < PAGE } : prev));
  }, [loading, page.done, page.items.length, params, key]);

  return { items: loading ? [] : page.items, loading, done: page.done, loadMore };
}
