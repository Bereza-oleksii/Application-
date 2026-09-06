import { inflateRaw } from 'pako';

export function inflateJson<T = unknown>(blob: Uint8Array): T {
  return JSON.parse(inflateRaw(blob, { toText: true })) as T;
}
