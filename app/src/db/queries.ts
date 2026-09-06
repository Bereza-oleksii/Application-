import { getDataDb } from './database';
import { inflateJson } from './inflate';
import { buildMatch, buildSearchQuery, ENTITY_COLS } from './sql';
import type { Category, EntitySummary, Kind, MapInfo, SearchParams, SpawnPoint } from './types';

interface EntityRow {
  kind: Kind; id: number; name: string; level: number | null; quality: number | null;
  image: string | null; tags: string; sub: string | null;
}

function rowToSummary(r: EntityRow): EntitySummary {
  let tags: string[] = [];
  try { tags = JSON.parse(r.tags || '[]'); } catch { /* ignore */ }
  let sub: Record<string, unknown> | null = null;
  if (r.sub) { try { sub = JSON.parse(r.sub); } catch { /* ignore */ } }
  return { kind: r.kind, id: r.id, name: r.name, level: r.level, quality: r.quality, image: r.image, tags, sub };
}

export async function searchEntities(params: SearchParams): Promise<EntitySummary[]> {
  const { sql, bind } = buildSearchQuery(params);
  const rows = await getDataDb().getAllAsync<EntityRow>(sql, bind);
  return rows.map(rowToSummary);
}

export async function countEntities(params: Pick<SearchParams, 'query' | 'kind' | 'tags'>): Promise<number> {
  const db = getDataDb();
  const match = buildMatch(params);
  const row = match
    ? await db.getFirstAsync<{ c: number }>('SELECT count(*) c FROM search WHERE search MATCH ?', match)
    : await db.getFirstAsync<{ c: number }>('SELECT count(*) c FROM entities');
  return row?.c ?? 0;
}

export async function countByKind(): Promise<Record<Kind, number>> {
  const rows = await getDataDb().getAllAsync<{ kind: Kind; c: number }>('SELECT kind, count(*) c FROM entities GROUP BY kind');
  const out = { item: 0, npc: 0, quest: 0, skill: 0, title: 0, harvest: 0 } as Record<Kind, number>;
  for (const r of rows) out[r.kind] = r.c;
  return out;
}

export async function getEntity(kind: Kind, id: number): Promise<EntitySummary | null> {
  const row = await getDataDb().getFirstAsync<EntityRow>(`SELECT ${ENTITY_COLS} FROM entities e WHERE kind = ? AND id = ?`, kind, id);
  return row ? rowToSummary(row) : null;
}

/** Resolves many ids of one kind at once (chunked to stay under the SQLite parameter limit). */
export async function getEntities(kind: Kind, ids: number[]): Promise<Map<number, EntitySummary>> {
  const out = new Map<number, EntitySummary>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 400) {
    const chunk = unique.slice(i, i + 400);
    const rows = await getDataDb().getAllAsync<EntityRow>(
      `SELECT ${ENTITY_COLS} FROM entities e WHERE kind = ? AND id IN (${chunk.map(() => '?').join(',')})`, [kind, ...chunk],
    );
    for (const r of rows) out.set(r.id, rowToSummary(r));
  }
  return out;
}

const BLOCK_CACHE_MAX = 6;
const blockCache = new Map<string, Record<string, unknown>>();

/** Detail JSON is stored in compressed blocks of consecutive ids; blocks are cached after inflating. */
export async function getDetail<T = Record<string, unknown>>(kind: Kind, id: number): Promise<T | null> {
  const row = await getDataDb().getFirstAsync<{ min_id: number; max_id: number; data: Uint8Array }>(
    'SELECT min_id, max_id, data FROM blocks WHERE kind = ? AND min_id <= ? ORDER BY min_id DESC LIMIT 1', kind, id,
  );
  if (!row || row.max_id < id) return null;
  const key = `${kind}:${row.min_id}`;
  let block = blockCache.get(key);
  if (!block) {
    block = inflateJson<Record<string, unknown>>(row.data);
    if (blockCache.size >= BLOCK_CACHE_MAX) blockCache.delete(blockCache.keys().next().value as string);
    blockCache.set(key, block);
  }
  return (block[String(id)] as T | undefined) ?? null;
}

export function clearDetailCache() { blockCache.clear(); }

export async function getCategories(kind: Kind): Promise<Category[]> {
  const rows = await getDataDb().getAllAsync<{ kind: Kind; id: number; parent_id: number | null; name: string; depth: number; path: string }>(
    'SELECT kind, id, parent_id, name, depth, path FROM categories WHERE kind = ? ORDER BY depth, id', kind,
  );
  return rows.map((r) => ({ kind: r.kind, id: r.id, parentId: r.parent_id, name: r.name, depth: r.depth, path: JSON.parse(r.path || '[]') }));
}

interface MapRow { id: number; code: string; name: string; type: string | null; preview: string | null; image: string | null; width: number | null; height: number | null; offset_x: number | null; offset_y: number | null }
const mapRow = (r: MapRow): MapInfo => ({ id: r.id, code: r.code, name: r.name, type: r.type, preview: r.preview, image: r.image, width: r.width, height: r.height, offsetX: r.offset_x, offsetY: r.offset_y });

export async function getMaps(): Promise<MapInfo[]> {
  const rows = await getDataDb().getAllAsync<MapRow>('SELECT * FROM maps ORDER BY type, name');
  return rows.map(mapRow);
}
export async function getMap(id: number): Promise<MapInfo | null> {
  const row = await getDataDb().getFirstAsync<MapRow>('SELECT * FROM maps WHERE id = ?', id);
  return row ? mapRow(row) : null;
}
export async function getMapsByIds(ids: number[]): Promise<Map<number, MapInfo>> {
  const out = new Map<number, MapInfo>();
  if (!ids.length) return out;
  const rows = await getDataDb().getAllAsync<MapRow>(`SELECT * FROM maps WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  for (const r of rows) out.set(r.id, mapRow(r));
  return out;
}

/** Entities (npc/harvest) present on a map, optionally filtered by name. */
export async function getMapEntities(mapId: number, kind: 'npc' | 'harvest', query = '', limit = 200): Promise<EntitySummary[]> {
  const q = query.trim().toLowerCase();
  const rows = await getDataDb().getAllAsync<EntityRow>(
    `SELECT ${ENTITY_COLS} FROM map_entities m JOIN entities e ON e.kind = m.kind AND e.id = m.id
     WHERE m.map_id = ? AND m.kind = ? ${q ? 'AND lower(e.name) LIKE ?' : ''} ORDER BY e.level, e.name LIMIT ?`,
    q ? [mapId, kind, `%${q}%`, limit] : [mapId, kind, limit],
  );
  return rows.map(rowToSummary);
}

export async function getEntityMaps(kind: 'npc' | 'harvest', id: number): Promise<MapInfo[]> {
  const rows = await getDataDb().getAllAsync<MapRow>(
    'SELECT mp.* FROM map_entities m JOIN maps mp ON mp.id = m.map_id WHERE m.kind = ? AND m.id = ? ORDER BY mp.name', kind, id,
  );
  return rows.map(mapRow);
}

export async function getSpawns(mapId: number, kind: 'npc' | 'harvest', id: number): Promise<SpawnPoint[]> {
  const row = await getDataDb().getFirstAsync<{ points: string }>('SELECT points FROM spawns WHERE map_id = ? AND kind = ? AND id = ?', mapId, kind, id);
  if (!row) return [];
  try { return JSON.parse(row.points) as SpawnPoint[]; } catch { return []; }
}

export async function hasSpawnData(): Promise<boolean> {
  const row = await getDataDb().getFirstAsync<{ c: number }>('SELECT count(*) c FROM spawns');
  return (row?.c ?? 0) > 0;
}

export async function getMeta(): Promise<Record<string, string>> {
  const rows = await getDataDb().getAllAsync<{ key: string; value: unknown }>("SELECT key, value FROM meta WHERE key != 'dict'");
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = String(r.value);
  return out;
}
