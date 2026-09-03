import * as Crypto from "expo-crypto";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < CHARS.length; i++) t[CHARS.charCodeAt(i)] = i;
  return t;
})();

/** Decode a base64 string to bytes (no Buffer/atob dependency). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4) - pad);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)]!;
    const b = LOOKUP[clean.charCodeAt(i + 1)]!;
    const c = LOOKUP[clean.charCodeAt(i + 2)]!;
    const d = LOOKUP[clean.charCodeAt(i + 3)]!;
    const chunk = (a << 18) | (b << 12) | (c << 6) | d;
    if (p < bytes.length) bytes[p++] = (chunk >> 16) & 0xff;
    if (p < bytes.length) bytes[p++] = (chunk >> 8) & 0xff;
    if (p < bytes.length) bytes[p++] = chunk & 0xff;
  }
  return bytes;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // expo-crypto's native digest (Kotlin) needs a TypedArray backed by an attached
  // ArrayBuffer; a detached `.buffer.slice()` fails with "no ArrayBuffer attached".
  const view = new Uint8Array(bytes);
  const buf = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, view);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
