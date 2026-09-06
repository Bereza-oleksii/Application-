#!/usr/bin/env node
/**
 * Runs the app's SQL builders (app/src/db/sql.ts) against a built database with node:sqlite.
 *   node scraper/test/query-test.mjs app/assets/db/aion_ru.db "меч стража"
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { buildSearchQuery, buildMatch } = await import(path.resolve(HERE, '../../app/src/db/sql.ts'));
const dbPath = process.argv[2] || 'app/assets/db/aion_ru.db';
const query = process.argv[3] || 'меч стража';
const db = new DatabaseSync(dbPath, { readOnly: true });
const time = (label, fn) => { const t0 = performance.now(); const r = fn(); console.log(`${label}: ${(performance.now() - t0).toFixed(1)} ms`); return r; };

const cases = [
  { query },
  { query, kind: 'item' },
  { query: 'тиам', kind: 'item', minLevel: 50, maxLevel: 65 },
  { kind: 'item', tags: ['Оружие', 'Мечи'], minLevel: 60 },
  { kind: 'npc', tags: ['Боссы'] },
  { kind: 'quest' },
  { query: 'a"b\'c(d)', kind: 'item' },
  { query: '   ' },
];
for (const c of cases) {
  const { sql, bind } = buildSearchQuery({ limit: 5, offset: 0, ...c });
  try {
    const rows = time(`search ${JSON.stringify(c)}`, () => db.prepare(sql).all(...bind));
    console.log('   ', rows.slice(0, 3).map((r) => `${r.kind}#${r.id} ${r.name} (lv${r.level})`).join(' | '), rows.length ? '' : '(no rows)');
  } catch (e) { console.log('   ERROR', e.message, '\n   match=', buildMatch(c)); process.exitCode = 1; }
}
const cnt = db.prepare('SELECT count(*) c FROM search WHERE search MATCH ?').get(buildMatch({ kind: 'item', tags: ['Доспехи', 'Кожаная броня', 'Верх'] }));
console.log('leather tops:', cnt.c);
const dict = db.prepare("SELECT value FROM meta WHERE key='dict'").get().value;
const row = db.prepare("SELECT d.kind, d.id, d.data FROM details d WHERE kind='item' LIMIT 1 OFFSET 100").get();
const json = JSON.parse(zlib.inflateRawSync(Buffer.from(row.data), { dictionary: Buffer.from(dict) }).toString('utf8'));
console.log('detail sample', row.kind, row.id, Object.keys(json).join(','));
console.log('maps:', db.prepare('SELECT count(*) c FROM maps').get().c, 'map_entities:', db.prepare('SELECT count(*) c FROM map_entities').get().c, 'spawns:', db.prepare('SELECT count(*) c FROM spawns').get().c);
console.log(db.prepare("SELECT key, value FROM meta WHERE key IN ('counts','built_at','lang')").all());
