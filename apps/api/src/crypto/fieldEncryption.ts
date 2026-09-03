import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// App-level AES-256-GCM encryption for sensitive health-content text columns
// (PLAN §5, research-backend §7). Stored value = base64(iv[12] || tag[16] || ciphertext).
// The key is read lazily so the API can boot for non-crypto routes without it.

function getKey(): Buffer {
  const b64 = process.env.FIELD_ENC_KEY;
  if (!b64) throw new Error("FIELD_ENC_KEY is not set (32-byte base64 required)");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("FIELD_ENC_KEY must decode to 32 bytes");
  return key;
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptField(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Encrypt only when a value is present; pass through null/undefined. */
export function encryptOptional(plain: string | null | undefined): string | null {
  return plain == null || plain === "" ? null : encryptField(plain);
}

export function decryptOptional(stored: string | null | undefined): string | null {
  return stored == null || stored === "" ? null : decryptField(stored);
}
