const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Minimal, dependency-free base64 encoder (Hermes does not guarantee btoa for binary data). */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  const len = bytes.length;
  while (i + 2 < len) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63] + CHARS[(n >> 6) & 63] + CHARS[n & 63];
    i += 3;
  }
  if (i < len) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const n = (b0 << 16) | (b1 << 8);
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63];
    out += i + 1 < len ? CHARS[(n >> 6) & 63] : '=';
    out += '=';
  }
  return out;
}
