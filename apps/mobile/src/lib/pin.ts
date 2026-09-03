import * as Crypto from "expo-crypto";
import { secure, KEYS } from "./secure";

// Local PIN gate. expo-crypto has no PBKDF2, so we iterate SHA-256 (bounded by the
// 5-attempt lock-out, not by hash cost). Verified on-device so the vault opens offline.
const ITERATIONS = 1000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin: string, saltHex: string): Promise<string> {
  let acc = `${saltHex}:${pin}`;
  for (let i = 0; i < ITERATIONS; i++) {
    acc = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, acc);
  }
  return acc;
}

export async function setPin(pin: string): Promise<void> {
  const saltHex = toHex(Crypto.getRandomBytes(16));
  const hash = await hashPin(pin, saltHex);
  await secure.set(KEYS.pinSalt, saltHex);
  await secure.set(KEYS.pinHash, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [saltHex, hash] = await Promise.all([secure.get(KEYS.pinSalt), secure.get(KEYS.pinHash)]);
  if (!saltHex || !hash) return false;
  return (await hashPin(pin, saltHex)) === hash;
}

export async function hasPin(): Promise<boolean> {
  return (await secure.get(KEYS.pinHash)) != null;
}

export async function clearPin(): Promise<void> {
  await Promise.all([secure.del(KEYS.pinHash), secure.del(KEYS.pinSalt)]);
}
