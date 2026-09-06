#!/usr/bin/env node
/**
 * Downloads every image referenced in data/raw/** into data/images/<relative path>.
 * Resumable: existing files are skipped.
 *
 *   node scraper/download-images.mjs [--raw data/raw] [--out data/images] [--concurrency 6]
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const BASE = 'https://db.aiondestiny.net';
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'] : null).filter(Boolean));
const RAW = path.resolve(args.raw || 'data/raw');
const OUT = path.resolve(args.out || 'data/images');
const CONCURRENCY = Number(args.concurrency || 6);
const URL_RE = /https?:\/\/db\.aiondestiny\.net\/images\/[^"\\\s]+/g;

const jar = new Map();
function cookieHeader() { return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }
function absorb(res) { for (const c of res.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', cookie: cookieHeader() }, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  absorb(res);
  if ([301, 302, 307].includes(res.status)) { if (attempt > 4) throw new Error('redirect loop'); await sleep(200); return download(url, attempt + 1); }
  if (res.status === 404) return null;
  if (!res.ok) { if (attempt > 5) throw new Error('HTTP ' + res.status); await sleep(500 * 2 ** attempt); return download(url, attempt + 1); }
  return Buffer.from(await res.arrayBuffer());
}

async function collectUrls() {
  const urls = new Set();
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(ndjson|json)$/.test(ent.name)) files.push(p);
    }
  };
  const files = [];
  walk(RAW);
  for (const f of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
    for await (const line of rl) for (const m of line.matchAll(URL_RE)) urls.add(m[0]);
  }
  // map images: the API returns a preview + the full map (maps.webp); make sure both are present
  for (const u of [...urls]) if (u.includes('/images/maps/')) { const dir = u.slice(0, u.lastIndexOf('/')); urls.add(dir + '/map_preview.webp'); urls.add(dir + '/maps.webp'); }
  return [...urls];
}

(async () => {
  const urls = await collectUrls();
  const todo = urls.filter((u) => !fs.existsSync(path.join(OUT, decodeURIComponent(new URL(u).pathname.replace(/^\/images\//, '')))));
  console.log(`images referenced=${urls.length} todo=${todo.length}`);
  let idx = 0, done = 0, missing = 0, bytes = 0;
  const missingLog = fs.openSync(path.join(OUT, '..', 'images-missing.txt'), 'a');
  fs.mkdirSync(OUT, { recursive: true });
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (idx < todo.length) {
      const u = todo[idx++];
      const rel = decodeURIComponent(new URL(u).pathname.replace(/^\/images\//, ''));
      const dest = path.join(OUT, rel);
      try {
        const buf = await download(u);
        if (!buf) { missing++; fs.writeSync(missingLog, u + '\n'); continue; }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        bytes += buf.length;
      } catch (e) { console.error('fail', u, e.message); fs.writeSync(missingLog, u + ' ' + e.message + '\n'); }
      if (++done % 200 === 0) console.log(`${done}/${todo.length} (${(bytes / 1e6).toFixed(1)} MB)`);
    }
  }));
  console.log(`done=${done} missing=${missing} bytes=${(bytes / 1e6).toFixed(1)} MB`);
})();
