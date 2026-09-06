import { inflateRaw } from 'pako';

let dictionary: Uint8Array | undefined;

/** Dictionary shared by every compressed detail row (stored in meta.dict). */
export function setInflateDictionary(dict: Uint8Array | null | undefined) {
  dictionary = dict ?? undefined;
}

export function inflateJson<T = unknown>(blob: Uint8Array): T {
  const text = inflateRaw(blob, { toText: true, dictionary });
  return JSON.parse(text) as T;
}
