import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const ACCESS_TTL = "15m";
export const REFRESH_TTL_DAYS = 30;

function secret(): Uint8Array {
  // A dev fallback keeps local runs working; production must set JWT_SECRET.
  return new TextEncoder().encode(env.JWT_SECRET ?? "dev-insecure-jwt-secret-change-me");
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret());
  if (!payload.sub) throw new Error("token has no subject");
  return payload.sub;
}

/** Opaque refresh token; only its SHA-256 hash is stored. */
export function newRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash: hashToken(token), expiresAt };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
