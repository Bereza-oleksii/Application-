#!/usr/bin/env node
/**
 * Scraper for the online Aion knowledge base (a Nuxt SPA backed by a JSON API under /api).
 * The base URL is taken from the SOURCE_URL environment variable, e.g.
 *   SOURCE_URL=https://example.com node scraper/scrape.mjs --lang ru --stage all
 * Everything is stored as NDJSON so the data can be turned into an offline SQLite
 * database (see build-db.mjs).
 *
 * Usage:
 *   node scraper/scrape.mjs --lang ru --stage all [--concurrency 8] [--out data/raw]
 *   stages: list | detail | categories | maps | spawns | races | all
 *
 * The scraper is resumable: already fetched records are skipped on restart.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const BASE = (process.env.SOURCE_URL || '').replace(/\/$/, '');
if (!BASE) { console.error('Set SOURCE_URL to the base URL of the online database (e.g. SOURCE_URL=https://example.com)'); process.exit(1); }
const KINDS = ['item', 'npc', 'quest', 'skill', 'title', 'harvest'];
const LIST_KEY = { item: 'items', npc: 'npcs', quest: 'quests', skill: 'skills', title: 'titles', harvest: 'harvests' };
const HAS_CATEGORIES = ['item', 'npc', 'quest', 'skill'];
const PAGE_LIMIT = 100; // server caps at 100

const args = parseArgs(process.argv.slice(2));
const LANG = args.lang || 'ru';
const OUT = path.resolve(args.out || 'data/raw', LANG);
const CONCURRENCY = Number(args.concurrency || 8);
const STAGE = args.stage || 'all';
const KIND_FILTER = args.kinds ? args.kinds.split(',') : KINDS;
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- HTTP layer
const jar = new Map();
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}
function absorbCookies(res) {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of set) {
    const [kv] = c.split(';');
    const i = kv.indexOf('=');
    if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
  }
}

let inflight = 0;
let requestCount = 0;
async function api(method, endpoint, body, attempt = 0) {
  const url = BASE + '/api' + endpoint;
  const headers = {
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    accept: 'application/json',
    lang: LANG,
    cookie: cookieHeader(),
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  try {
    inflight++;
    requestCount++;
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(60_000),
    });
    absorbCookies(res);
    if (res.status === 302 || res.status === 301 || res.status === 307) {
      // anti-bot cookie dance: the server sets __hash_ and redirects to the same URL
      if (attempt > 4) throw new Error('redirect loop');
      await sleep(200 * (attempt + 1));
      return api(method, endpoint, body, attempt + 1);
    }
    if (res.status === 404) return null;
    if (res.status === 429 || res.status >= 500) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw Object.assign(new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`), { fatal: res.status === 400 });
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      if (attempt > 4) throw new Error('non-json response');
      await sleep(500);
      return api(method, endpoint, body, attempt + 1);
    }
    return await res.json();
  } catch (e) {
    if (e.fatal) throw e;
    if (attempt >= 6) throw e;
    const backoff = Math.min(30_000, 500 * 2 ** attempt) + Math.random() * 300;
    await sleep(backoff);
    return api(method, endpoint, body, attempt + 1);
  } finally {
    inflight--;
  }
}

// ---------------------------------------------------------------- helpers
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[k] = v;
    }
  }
  return out;
}
async function readNdjson(file, fn) {
  if (!fs.existsSync(file)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { fn(JSON.parse(line)); } catch { /* ignore truncated last line */ }
  }
}
class NdjsonWriter {
  constructor(file) { this.fd = fs.openSync(file, 'a'); this.count = 0; }
  write(obj) { fs.writeSync(this.fd, JSON.stringify(obj) + '\n'); this.count++; }
  close() { fs.closeSync(this.fd); }
}
async function pool(items, worker, concurrency = CONCURRENCY, onProgress) {
  let idx = 0; let done = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const item = items[idx++];
      try { await worker(item); } catch (e) { console.error('worker error', e.message); }
      done++;
      if (onProgress && done % 200 === 0) onProgress(done, items.length);
    }
  });
  await Promise.all(runners);
}
function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

// ---------------------------------------------------------------- stages
async function stageList(kind) {
  const file = path.join(OUT, `${kind}.list.ndjson`);
  const doneFile = path.join(OUT, `${kind}.list.done`);
  if (fs.existsSync(doneFile)) { log(`[list:${kind}] already complete`); return; }
  fs.rmSync(file, { force: true });
  const w = new NdjsonWriter(file);
  const body = { sortType: 0, page: 1, limit: PAGE_LIMIT };
  if (kind === 'item' || kind === 'npc' || kind === 'quest') body.categoryId = 0;
  const first = await api('POST', `/${kind}/search`, body);
  const totalPage = first.totalPage;
  log(`[list:${kind}] totalCount=${first.totalCount} pages=${totalPage}`);
  const seen = new Set();
  const store = (page) => {
    for (const row of page[LIST_KEY[kind]] || []) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      w.write(row);
    }
  };
  store(first);
  const pages = Array.from({ length: totalPage - 1 }, (_, i) => i + 2);
  await pool(pages, async (p) => {
    const res = await api('POST', `/${kind}/search`, { ...body, page: p });
    if (res) store(res);
  }, CONCURRENCY, (d, t) => log(`[list:${kind}] ${d}/${t} pages`));
  w.close();
  fs.writeFileSync(doneFile, String(seen.size));
  log(`[list:${kind}] saved ${seen.size} ids`);
}

async function stageDetail(kind) {
  const listFile = path.join(OUT, `${kind}.list.ndjson`);
  const detailFile = path.join(OUT, `${kind}.ndjson`);
  const errFile = path.join(OUT, `${kind}.errors.ndjson`);
  const ids = [];
  await readNdjson(listFile, (r) => ids.push(r.id));
  const have = new Set();
  await readNdjson(detailFile, (r) => have.add(r.__id));
  const todo = ids.filter((id) => !have.has(id));
  log(`[detail:${kind}] total=${ids.length} have=${have.size} todo=${todo.length}`);
  if (!todo.length) return;
  const w = new NdjsonWriter(detailFile);
  const ew = new NdjsonWriter(errFile);
  const t0 = Date.now();
  await pool(todo, async (id) => {
    try {
      const info = await api('POST', `/${kind}/info/${id}`, {});
      if (info === null) { ew.write({ id, error: 'not found' }); return; }
      w.write({ __id: id, ...info });
    } catch (e) {
      ew.write({ id, error: e.message });
    }
  }, CONCURRENCY, (d, t) => {
    const rate = d / ((Date.now() - t0) / 1000);
    const eta = Math.round((t - d) / rate / 60);
    log(`[detail:${kind}] ${d}/${t} (${rate.toFixed(1)} req/s, eta ${eta} min)`);
  });
  w.close(); ew.close();
  log(`[detail:${kind}] done, written=${w.count}, errors=${ew.count}`);
}

async function stageCategories() {
  for (const kind of HAS_CATEGORIES) {
    const file = path.join(OUT, `categories.${kind}.json`);
    const data = await api('GET', `/${kind}/categories`);
    fs.writeFileSync(file, JSON.stringify(data));
    log(`[categories:${kind}] saved`);
  }
}

async function stageMaps() {
  const listFile = path.join(OUT, 'map.list.json');
  const infoFile = path.join(OUT, 'map.ndjson');
  const npcFile = path.join(OUT, 'map.npcs.ndjson');
  const list = await api('GET', '/map/list');
  fs.writeFileSync(listFile, JSON.stringify(list));
  const maps = list.maps || [];
  log(`[maps] ${maps.length} maps`);
  fs.rmSync(infoFile, { force: true });
  fs.rmSync(npcFile, { force: true });
  const iw = new NdjsonWriter(infoFile);
  const nw = new NdjsonWriter(npcFile);
  await pool(maps, async (m) => {
    const info = await api('POST', `/map/info/${m.id}`, {});
    if (info) iw.write({ __id: m.id, ...info });
    // all NPCs present on the map
    let page = 1; let totalPage = 1;
    do {
      const res = await api('POST', '/map/search-npc', { mapId: m.id, query: '', page, limit: PAGE_LIMIT });
      if (!res) break;
      totalPage = res.totalPage || 1;
      for (const n of res.npcs || []) nw.write({ mapId: m.id, npcId: n.id, desc: n.desc, imageUrl: n.imageUrl });
      page++;
    } while (page <= totalPage);
    // harvest nodes on the map
    page = 1; totalPage = 1;
    do {
      const res = await api('POST', '/map/search-harvest', { mapId: m.id, query: '', page, limit: PAGE_LIMIT });
      if (!res) break;
      totalPage = res.totalPage || 1;
      for (const h of res.harvests || []) nw.write({ mapId: m.id, harvestId: h.id, desc: h.desc, imageUrl: h.imageUrl });
      page++;
    } while (page <= totalPage);
  }, Math.min(CONCURRENCY, 4));
  iw.close(); nw.close();
  log(`[maps] info=${iw.count} map-entity rows=${nw.count}`);
}

async function stageSpawns() {
  const npcFile = path.join(OUT, 'map.npcs.ndjson');
  const spawnFile = path.join(OUT, 'map.spawns.ndjson');
  const pairs = [];
  await readNdjson(npcFile, (r) => pairs.push(r));
  const have = new Set();
  await readNdjson(spawnFile, (r) => have.add(`${r.mapId}:${r.npcId ?? ''}:${r.harvestId ?? ''}`));
  const todo = pairs.filter((p) => !have.has(`${p.mapId}:${p.npcId ?? ''}:${p.harvestId ?? ''}`));
  log(`[spawns] pairs=${pairs.length} todo=${todo.length}`);
  const w = new NdjsonWriter(spawnFile);
  const t0 = Date.now();
  await pool(todo, async (p) => {
    // the site sends harvest ids in the npcId field as well
    const body = { mapId: p.mapId, npcId: p.npcId ?? p.harvestId };
    try {
      const res = await api('POST', '/map/search-spawn', body);
      w.write({ mapId: p.mapId, npcId: p.npcId, harvestId: p.harvestId, spawns: (res && res.spawns) || [] });
    } catch (e) {
      w.write({ mapId: p.mapId, npcId: p.npcId, harvestId: p.harvestId, spawns: [], error: e.message });
    }
  }, CONCURRENCY, (d, t) => {
    const rate = d / ((Date.now() - t0) / 1000);
    log(`[spawns] ${d}/${t} (${rate.toFixed(1)} req/s, eta ${Math.round((t - d) / rate / 60)} min)`);
  });
  w.close();
  log(`[spawns] done ${w.count}`);
}

async function stageRaces() {
  const file = path.join(OUT, 'item.races.json');
  const out = {};
  for (const [name, race] of [['elyos', 0], ['asmodian', 1]]) {
    const body = { sortType: 0, categoryId: 0, race, page: 1, limit: PAGE_LIMIT };
    const first = await api('POST', '/item/search', body);
    const ids = new Set((first.items || []).map((r) => r.id));
    const pages = Array.from({ length: (first.totalPage || 1) - 1 }, (_, i) => i + 2);
    await pool(pages, async (pg) => {
      const res = await api('POST', '/item/search', { ...body, page: pg });
      for (const r of (res && res.items) || []) ids.add(r.id);
    }, CONCURRENCY, (d, t) => log(`[races:${name}] ${d}/${t} pages`));
    out[name] = [...ids].sort((a, b) => a - b);
    log(`[races:${name}] ${out[name].length} items`);
  }
  fs.writeFileSync(file, JSON.stringify(out));
}

// ---------------------------------------------------------------- main
(async () => {
  log(`lang=${LANG} out=${OUT} stage=${STAGE} concurrency=${CONCURRENCY}`);
  // prime cookies
  await api('GET', '/map/list').catch(() => {});
  const run = (s) => STAGE === 'all' || STAGE === s;
  if (run('categories')) await stageCategories();
  if (run('list')) for (const k of KIND_FILTER) await stageList(k);
  if (run('maps')) await stageMaps();
  if (run('detail')) for (const k of KIND_FILTER) await stageDetail(k);
  if (run('spawns') && STAGE !== 'all') await stageSpawns();
  if (run('races')) await stageRaces();
  log(`finished. requests=${requestCount}`);
})().catch((e) => { console.error(e); process.exit(1); });
