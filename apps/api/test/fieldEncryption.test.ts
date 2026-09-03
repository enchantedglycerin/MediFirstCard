import { describe, it, expect } from "vitest";
import {
  encryptField,
  decryptField,
  encryptOptional,
  decryptOptional,
  isEncryptionConfigured,
} from "../src/crypto/fieldEncryption.js";
import { isValidThaiId } from "@mfc/shared";

describe("AES-256-GCM field encryption", () => {
  it("is configured in tests", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });

  it("round-trips Thai text", () => {
    const plain = "แพ้ยาเพนิซิลลิน รุนแรง";
    const enc = encryptField(plain);
    expect(enc).not.toContain(plain);
    expect(decryptField(enc)).toBe(plain);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptField("O+")).not.toBe(encryptField("O+"));
  });

  it("fails to decrypt tampered ciphertext", () => {
    const enc = encryptField("secret");
    const buf = Buffer.from(enc, "base64");
    const last = buf.length - 1;
    buf[last] = (buf[last] ?? 0) ^ 0xff; // flip a ciphertext byte -> GCM tag mismatch
    expect(() => decryptField(buf.toString("base64"))).toThrow();
  });

  it("passes null/empty through the optional helpers", () => {
    expect(encryptOptional(null)).toBeNull();
    expect(encryptOptional("")).toBeNull();
    expect(decryptOptional(null)).toBeNull();
    const enc = encryptOptional("x");
    expect(enc).not.toBeNull();
    expect(decryptOptional(enc)).toBe("x");
  });
});

describe("workspace wiring", () => {
  it("imports and runs code from @mfc/shared", () => {
    expect(isValidThaiId("1101700230708")).toBe(true);
  });
});
