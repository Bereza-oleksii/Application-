#!/usr/bin/env node
/**
 * Builds the offline SQLite databases used by the mobile app.
 *
 *   node scraper/build-db.mjs --lang ru [--raw data/raw] [--images data/images] [--out app/assets/db] [--assets false] [--main false]
 *
 * Produces:
 *   <out>/aion_<lang>.db  – entities (+FTS5 index), compressed detail JSON, categories, maps, spawns
 *   <out>/assets.db       – all images as BLOBs (shared between languages)
 *
 * Detail JSON is normalised:
 *   - imageUrl -> image (path relative to /images/)
 *   - referenced entities ({id, desc, imageUrl, ...}) lose desc/imageUrl (see ref-kinds.json)
 *   - stored in blocks of 64 consecutive ids, each block a raw-deflate BLOB ({id: detail, ...})
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REF_KINDS = JSON.parse(fs.readFileSync(path.join(HERE, 'ref-kinds.json'), 'utf8'));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'] : null).filter(Boolean));
const LANG = args.lang || 'ru';
const RAW = path.resolve(args.raw || 'data/raw', LANG);
const IMAGES = path.resolve(args.images || 'data/images');
const OUT = path.resolve(args.out || 'app/assets/db');
fs.mkdirSync(OUT, { recursive: true });

const KINDS = ['item', 'npc', 'quest', 'skill', 'title', 'harvest'];
const BLOCK_SIZE = Number(args['block-size'] || 64);
const IMG_PREFIX = /^https?:\/\/db\.aiondestiny\.net\/images\//;
const img = (u) => (typeof u === 'string' ? decodeURIComponent(u.replace(IMG_PREFIX, '')) : null);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function* ndjson(file) {
  if (!fs.existsSync(file)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) { if (line.trim()) { try { yield JSON.parse(line); } catch { /* skip */ } } }
}

/** Normalise a detail object: relative image paths, strip redundant names of referenced entities. */
function normalize(obj, kind, field = null) {
  if (Array.isArray(obj)) return obj.map((v) => normalize(v, kind, field));
  if (obj && typeof obj === 'object') {
    const refKind = field && REF_KINDS[kind] && REF_KINDS[kind][field];
    const isRef = refKind && typeof obj.id === 'number';
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__id') continue;
      if (isRef && (k === 'desc' || k === 'imageUrl')) continue;
      if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) continue;
      if (k === 'imageUrl') { out.image = img(v); continue; }
      out[k] = normalize(v, kind, k);
    }
    return out;
  }
  return obj;
}

/** Build a zlib preset dictionary from the most frequent strings of a sample. */
function buildDictionary(samples) {
  const freq = new Map();
  for (const s of samples) for (const tok of s.match(/"[^"]{2,60}"|[\[\]{}:,]+/g) || []) freq.set(tok, (freq.get(tok) || 0) + 1);
  const sorted = [...freq.entries()].filter(([, c]) => c > 1).sort((a, b) => a[1] - b[1]); // least frequent first: zlib prefers frequent strings at the end
  let dict = '';
  for (const [tok] of sorted) { if (Buffer.byteLength(dict) + Buffer.byteLength(tok) > 32000) break; dict += tok; }
  return Buffer.from(dict, 'utf8');
}

// ------------------------------------------------------------------ main db
async function buildMain() {
  const file = path.join(OUT, `aion_${LANG}.db`);
  fs.rmSync(file, { force: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA page_size = 4096;
    CREATE TABLE meta (key TEXT PRIMARY KEY, value);
    CREATE TABLE entities (
      rowid INTEGER PRIMARY KEY,
      kind TEXT NOT NULL, id INTEGER NOT NULL, name TEXT NOT NULL, level INTEGER, quality INTEGER,
      image TEXT, tags TEXT NOT NULL DEFAULT '[]', sub TEXT,
      race INTEGER, -- items: bitmask 1 = Elyos, 2 = Asmodian (from the site's race filter)
      UNIQUE (kind, id)
    );
    -- detail JSON is stored in blocks of BLOCK_SIZE consecutive ids: {id: detail, ...} as raw-deflate
    CREATE TABLE blocks (kind TEXT NOT NULL, min_id INTEGER NOT NULL, max_id INTEGER NOT NULL, count INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (kind, min_id));
    CREATE TABLE categories (kind TEXT NOT NULL, id INTEGER NOT NULL, parent_id INTEGER, name TEXT, depth INTEGER, path TEXT, PRIMARY KEY (kind, id));
    CREATE TABLE maps (id INTEGER PRIMARY KEY, code TEXT, name TEXT, type TEXT, preview TEXT, image TEXT, width INTEGER, height INTEGER, offset_x INTEGER, offset_y INTEGER);
    CREATE TABLE map_entities (map_id INTEGER NOT NULL, kind TEXT NOT NULL, id INTEGER NOT NULL, PRIMARY KEY (map_id, kind, id)) WITHOUT ROWID;
    CREATE TABLE spawns (map_id INTEGER NOT NULL, kind TEXT NOT NULL, id INTEGER NOT NULL, points TEXT NOT NULL, PRIMARY KEY (map_id, kind, id)) WITHOUT ROWID;
    CREATE VIRTUAL TABLE search USING fts5(kind, name, tags, content='entities', content_rowid='rowid', tokenize = "unicode61 remove_diacritics 2");
  `);
  const prep = (sql) => { const st = db.prepare(sql); return { run: (...a) => st.run(...a.map((v) => (v === undefined ? null : v))), get: (...a) => st.get(...a) }; };
  const insEnt = prep('INSERT OR IGNORE INTO entities (kind,id,name,level,quality,image,tags,sub) VALUES (?,?,?,?,?,?,?,?)');
  const insBlock = prep('INSERT OR REPLACE INTO blocks (kind,min_id,max_id,count,data) VALUES (?,?,?,?,?)');
  const insCat = prep('INSERT OR REPLACE INTO categories (kind,id,parent_id,name,depth,path) VALUES (?,?,?,?,?,?)');
  const insMap = prep('INSERT OR REPLACE INTO maps (id,code,name,type,preview,image,width,height,offset_x,offset_y) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const insMapEnt = prep('INSERT OR IGNORE INTO map_entities (map_id,kind,id) VALUES (?,?,?)');
  const insSpawn = prep('INSERT OR REPLACE INTO spawns (map_id,kind,id,points) VALUES (?,?,?,?)');

  const deflate = (str) => zlib.deflateRawSync(Buffer.from(str, 'utf8'), { level: 9 });

  const counts = {};
  let rawBytes = 0, compBytes = 0;
  for (const kind of KINDS) {
    db.exec('BEGIN');
    let n = 0;
    for await (const r of ndjson(path.join(RAW, `${kind}.list.ndjson`))) {
      const sub = {};
      if (kind === 'harvest') { sub.skillName = r.skillName; sub.skillLevel = r.skillLevel; }
      insEnt.run(kind, r.id, r.desc ?? '', r.level ?? null, r.quality ?? null, img(r.imageUrl), JSON.stringify(r.tags || []), Object.keys(sub).length ? JSON.stringify(sub) : null);
      n++;
    }
    db.exec('COMMIT');
    log(`[${kind}] ${n} summaries`);
    // details: collect (id, json) for the whole kind, sort by id, write compressed blocks
    db.exec('BEGIN');
    const rows = [];
    for await (const r of ndjson(path.join(RAW, `${kind}.ndjson`))) {
      const id = r.__id ?? r.id ?? r.itemId;
      rows.push([id, JSON.stringify(normalize(r, kind))]);
      // make sure every detailed entity also has a summary row (lists can miss a few)
      insEnt.run(kind, id, r.desc ?? '', r.level ?? null, r.quality ?? null, img(r.imageUrl), JSON.stringify(r.tags || []), null);
    }
    rows.sort((a, b) => a[0] - b[0]);
    let nb = 0;
    for (let i = 0; i < rows.length; i += BLOCK_SIZE) {
      const chunk = rows.slice(i, i + BLOCK_SIZE);
      const json = '{' + chunk.map(([id, j]) => `"${id}":${j}`).join(',') + '}';
      const blob = deflate(json);
      rawBytes += json.length; compBytes += blob.length;
      insBlock.run(kind, chunk[0][0], chunk[chunk.length - 1][0], chunk.length, blob);
      nb++;
    }
    db.exec('COMMIT');
    counts[kind] = { summaries: n, details: rows.length };
    log(`[${kind}] ${rows.length} details in ${nb} blocks`);
  }
  log(`details raw ${(rawBytes / 1e6).toFixed(1)} MB -> compressed ${(compBytes / 1e6).toFixed(1)} MB`);

  // item race bitmask (language independent; reuse any sibling language dir)
  let raceFile = path.join(RAW, 'item.races.json');
  if (!fs.existsSync(raceFile)) for (const d of fs.readdirSync(path.dirname(RAW))) { const c = path.join(path.dirname(RAW), d, 'item.races.json'); if (fs.existsSync(c)) { raceFile = c; break; } }
  if (fs.existsSync(raceFile)) {
    const races = JSON.parse(fs.readFileSync(raceFile, 'utf8'));
    const mask = new Map();
    for (const id of races.elyos || []) mask.set(id, (mask.get(id) || 0) | 1);
    for (const id of races.asmodian || []) mask.set(id, (mask.get(id) || 0) | 2);
    const upd = prep("UPDATE entities SET race = ? WHERE kind = 'item' AND id = ?");
    db.exec('BEGIN');
    db.exec("UPDATE entities SET race = 0 WHERE kind = 'item'");
    for (const [id, m] of mask) upd.run(m, id);
    db.exec('COMMIT');
    log(`[races] ${mask.size} items tagged from ${raceFile}`);
  } else log('[races] item.races.json not found, race filter will be empty');

  // categories
  db.exec('BEGIN');
  for (const kind of ['item', 'npc', 'quest', 'skill']) {
    const f = path.join(RAW, `categories.${kind}.json`);
    if (!fs.existsSync(f)) continue;
    const walk = (node, parent, depth, trail) => {
      const p = depth === 0 ? [] : [...trail, node.desc];
      insCat.run(kind, node.id, parent, node.desc ?? '', depth, JSON.stringify(p));
      for (const c of node.childs || []) walk(c, node.id, depth + 1, p);
    };
    walk(JSON.parse(fs.readFileSync(f, 'utf8')), null, 0, []);
  }
  db.exec('COMMIT');

  // maps
  db.exec('BEGIN');
  const listFile = path.join(RAW, 'map.list.json');
  const previews = new Map();
  if (fs.existsSync(listFile)) for (const m of JSON.parse(fs.readFileSync(listFile, 'utf8')).maps || []) previews.set(m.id, m);
  let nm = 0;
  for await (const m of ndjson(path.join(RAW, 'map.ndjson'))) {
    const p = previews.get(m.id) || {};
    insMap.run(m.id, m.name, m.desc, m.type, img(p.imageUrl) || `maps/${m.name}/map_preview.webp`, img(m.imageUrl), m.mapWidth, m.mapHeight, m.mapOffsetX, m.mapOffsetY);
    previews.delete(m.id);
    nm++;
  }
  for (const [id, m] of previews) { insMap.run(id, m.name, m.desc, m.type, img(m.imageUrl), null, null, null, null, null); nm++; }
  let nme = 0;
  for await (const r of ndjson(path.join(RAW, 'map.npcs.ndjson'))) { insMapEnt.run(r.mapId, r.npcId !== undefined ? 'npc' : 'harvest', r.npcId ?? r.harvestId); nme++; }
  let ns = 0;
  let spawnFile = path.join(RAW, 'map.spawns.ndjson');
  if (!fs.existsSync(spawnFile)) {
    for (const d of fs.readdirSync(path.dirname(RAW))) { const cand = path.join(path.dirname(RAW), d, 'map.spawns.ndjson'); if (fs.existsSync(cand)) { spawnFile = cand; log(`using spawn data from ${cand}`); break; } }
  }
  for await (const r of ndjson(spawnFile)) {
    if (!r.spawns || !r.spawns.length) continue;
    const kind = r.npcId !== undefined && r.npcId !== null ? 'npc' : 'harvest';
    insSpawn.run(r.mapId, kind, r.npcId ?? r.harvestId, JSON.stringify(r.spawns.map((s) => [s.x, s.y, s.z])));
    ns += r.spawns.length;
  }
  db.exec('COMMIT');
  log(`[maps] ${nm} maps, ${nme} map-entity rows, ${ns} spawn points`);

  db.exec(`
    CREATE INDEX idx_entities_kind_level ON entities (kind, level, quality, race);
    CREATE INDEX idx_map_entities_ent ON map_entities (kind, id);
    INSERT INTO search(search) VALUES ('rebuild');
    INSERT INTO search(search) VALUES ('optimize');
  `);
  const meta = prep('INSERT INTO meta (key,value) VALUES (?,?)');
  meta.run('lang', LANG);
  meta.run('source', 'https://db.aiondestiny.net');
  meta.run('built_at', new Date().toISOString());
  meta.run('counts', JSON.stringify(counts));
  meta.run('schema_version', '4');
  meta.run('block_size', String(BLOCK_SIZE));
  db.exec('VACUUM');
  db.close();
  log(`wrote ${file} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
}

// ------------------------------------------------------------------ assets db
const MAP_SIZE = Number(args['map-size'] || 1536);
const MAP_QUALITY = Number(args['map-quality'] || 72);

async function loadSharp() {
  try { return (await import('sharp')).default; } catch { log('sharp not installed: full-size map images are stored as-is (npm install in scraper/)'); return null; }
}

async function buildAssets() {
  const file = path.join(OUT, 'assets.db');
  fs.rmSync(file, { force: true });
  const sharp = await loadSharp();
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;
    CREATE TABLE images (path TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL) WITHOUT ROWID;
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);`);
  const ins = db.prepare('INSERT OR REPLACE INTO images (path,mime,data) VALUES (?,?,?)');
  const mime = (p) => ({ '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' })[path.extname(p).toLowerCase()] || 'application/octet-stream';
  const files = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p); else files.push(p);
    }
  };
  if (fs.existsSync(IMAGES)) walk(IMAGES);
  let n = 0, bytes = 0, resized = 0;
  db.exec('BEGIN');
  for (const p of files) {
    const rel = path.relative(IMAGES, p).split(path.sep).join('/');
    let buf = fs.readFileSync(p);
    // full-size maps are 3072x3072 and up to 9 MB each: downscale them for the phone
    if (sharp && /^maps\/[^/]+\/maps\.webp$/.test(rel)) {
      try {
        const meta = await sharp(buf).metadata();
        if ((meta.width || 0) > MAP_SIZE || (meta.height || 0) > MAP_SIZE) {
          buf = await sharp(buf).resize(MAP_SIZE, MAP_SIZE, { fit: 'inside' }).webp({ quality: MAP_QUALITY }).toBuffer();
          resized++;
        }
      } catch (e) { log(`resize failed for ${rel}: ${e.message}`); }
    }
    ins.run(rel, mime(p), buf);
    n++; bytes += buf.length;
  }
  db.exec('COMMIT');
  db.prepare('INSERT INTO meta (key,value) VALUES (?,?)').run('built_at', new Date().toISOString());
  db.prepare('INSERT INTO meta (key,value) VALUES (?,?)').run('count', String(n));
  db.prepare('INSERT INTO meta (key,value) VALUES (?,?)').run('map_size', String(MAP_SIZE));
  db.exec('VACUUM');
  db.close();
  log(`wrote ${file}: ${n} images (${resized} maps downscaled to ${MAP_SIZE}px), ${(bytes / 1e6).toFixed(1)} MB raw, file ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
}

/** Writes app/src/db/bundles.generated.ts + manifest so the app knows which databases are bundled. */
function writeBundles() {
  const appSrc = path.resolve(OUT, '..', '..', 'src', 'db');
  if (!fs.existsSync(appSrc)) { log('skip bundles.generated.ts (no app src dir next to out)'); return; }
  const files = fs.readdirSync(OUT).filter((f) => /^aion_[a-z]{2}\.db$/.test(f)).sort();
  const manifest = {};
  const lines = [];
  for (const f of files) {
    const lang = f.slice(5, 7);
    const st = fs.statSync(path.join(OUT, f));
    manifest[lang] = { size: st.size, builtAt: st.mtime.toISOString() };
    lines.push(`  ${lang}: require('../../assets/db/${f}'),`);
  }
  const assetsFile = path.join(OUT, 'assets.db');
  if (fs.existsSync(assetsFile)) { const st = fs.statSync(assetsFile); manifest.assets = { size: st.size, builtAt: st.mtime.toISOString() }; }
  const src = `// GENERATED by scraper/build-db.mjs — do not edit by hand.
export const DATA_BUNDLES: Record<string, number> = {
${lines.join('\n')}
};
export const ASSETS_BUNDLE: number = require('../../assets/db/assets.db');
export const MANIFEST: Record<string, { size: number; builtAt: string }> = ${JSON.stringify(manifest, null, 2)};
export const DATA_LANGS = Object.keys(DATA_BUNDLES);
`;
  fs.writeFileSync(path.join(appSrc, 'bundles.generated.ts'), src);
  log(`bundles.generated.ts: ${files.join(', ') || 'no data dbs'}`);
}

(async () => {
  if (args.assets !== 'false') await buildAssets();
  if (args.main !== 'false') await buildMain();
  fs.copyFileSync(path.join(HERE, 'ref-kinds.json'), path.join(OUT, 'ref-kinds.json'));
  writeBundles();
})().catch((e) => { console.error(e); process.exit(1); });
