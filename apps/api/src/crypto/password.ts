import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt (memory-hard, built into Node) for password + PIN-fallback hashing.
// PLAN specified argon2id; scrypt is chosen to avoid a native dependency on the
// Windows dev machine, CI and Render. Documented in the local working notes.
const N = 16384; // CPU/memory cost (~16 MB with r=8)
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const expected = Buffer.from(parts[5] ?? "", "base64");
  if (!expected.length) return false;
  const dk = scryptSync(password, salt, expected.length, { N: n, r, p });
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}
