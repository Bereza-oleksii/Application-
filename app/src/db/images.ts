import { toBase64 } from './base64';
import { getAssetsDb } from './database';

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
const MAX_CACHE = 600;

/**
 * Returns a data: URI for an image path (e.g. "items/icon_item_sword_e01.png"),
 * or null when the image is not in the bundle.
 */
export function getImageUri(path: string | null | undefined): Promise<string | null> {
  if (!path) return Promise.resolve(null);
  const hit = cache.get(path);
  if (hit !== undefined) return Promise.resolve(hit);
  const inflight = pending.get(path);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const row = await getAssetsDb().getFirstAsync<{ mime: string; data: Uint8Array }>(
        'SELECT mime, data FROM images WHERE path = ?', path,
      );
      const uri = row ? `data:${row.mime};base64,${toBase64(row.data)}` : null;
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
      cache.set(path, uri);
      return uri;
    } catch {
      return null;
    } finally {
      pending.delete(path);
    }
  })();
  pending.set(path, p);
  return p;
}
