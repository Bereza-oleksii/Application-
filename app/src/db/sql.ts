/**
 * Pure SQL builders (no Expo imports) so they can be unit-tested in Node against the real database.
 */
import type { SearchParams } from './types';

export const ENTITY_COLS = 'e.kind, e.id, e.name, e.level, e.quality, e.image, e.tags, e.sub, e.race';

/** Escapes a token for FTS5: wrap in double quotes, optionally add the prefix operator. */
export function ftsToken(tok: string, prefix: boolean) {
  const safe = tok.replace(/"/g, '""');
  return `"${safe}"${prefix ? '*' : ''}`;
}

export function tokenize(q: string): string[] {
  return q.split(/[\s,.;:!?()[\]{}"'«»/\\|+*^~-]+/).filter((t) => t.length > 0);
}

export function buildMatch(params: Pick<SearchParams, 'query' | 'kind' | 'tags'>): string | null {
  const parts: string[] = [];
  if (params.kind) parts.push(`kind:${ftsToken(params.kind, false)}`);
  for (const t of params.tags ?? []) if (t.trim()) parts.push(`tags:${ftsToken(t.trim(), false)}`);
  const tokens = tokenize((params.query ?? '').trim());
  if (tokens.length) parts.push('name:(' + tokens.map((t) => ftsToken(t, true)).join(' ') + ')');
  return parts.length ? parts.join(' AND ') : null;
}

export function buildSearchQuery(params: SearchParams): { sql: string; bind: (string | number)[] } {
  const match = buildMatch(params);
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (params.minLevel !== undefined) { where.push('e.level >= ?'); args.push(params.minLevel); }
  if (params.maxLevel !== undefined) { where.push('e.level <= ?'); args.push(params.maxLevel); }
  if (params.quality && params.quality.length) { where.push(`e.quality IN (${params.quality.map(() => '?').join(',')})`); args.push(...params.quality); }
  if (params.race !== undefined) { where.push('(e.race & ?) != 0'); args.push(params.race); }
  const hasQuery = tokenize((params.query ?? '').trim()).length > 0;
  if (match) {
    const nameExact = (params.query ?? '').trim().toLowerCase();
    const sql = `SELECT ${ENTITY_COLS} FROM search s JOIN entities e ON e.rowid = s.rowid
      WHERE search MATCH ? ${where.length ? 'AND ' + where.join(' AND ') : ''}
      ORDER BY ${hasQuery ? '(lower(e.name) = ?) DESC, bm25(search), e.level, e.name' : '(e.level IS NULL), e.level, e.quality DESC, e.name'}
      LIMIT ? OFFSET ?`;
    return { sql, bind: [match, ...args, ...(hasQuery ? [nameExact] : []), params.limit, params.offset] };
  }
  const sql = `SELECT ${ENTITY_COLS} FROM entities e ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY (e.level IS NULL), e.level, e.quality DESC, e.name LIMIT ? OFFSET ?`;
  return { sql, bind: [...args, params.limit, params.offset] };
}
