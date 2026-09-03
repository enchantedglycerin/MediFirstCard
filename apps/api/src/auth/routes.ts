import { Router } from "express";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import type { AppContext } from "../context.js";
import { users, refreshTokens } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../crypto/password.js";
import { signAccessToken, newRefreshToken, hashToken } from "./tokens.js";

const registerBody = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  locale: z.enum(["th", "en"]).default("th"),
});
const loginBody = z.object({ email: z.string().email(), password: z.string() });
const refreshBody = z.object({ refreshToken: z.string().min(1) });
const logoutBody = z.object({ refreshToken: z.string().min(1), all: z.boolean().optional() });

async function issueTokens(ctx: AppContext, userId: string) {
  const access = await signAccessToken(userId);
  const rt = newRefreshToken();
  await ctx.db.insert(refreshTokens).values({ userId, tokenHash: rt.hash, expiresAt: rt.expiresAt });
  return { accessToken: access, refreshToken: rt.token };
}

export function authRoutes(ctx: AppContext): Router {
  const r = Router();

  r.post("/auth/register", async (req, res, next) => {
    try {
      const body = registerBody.parse(req.body);
      const existing = await ctx.db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
      if (existing.length > 0) {
        res.status(409).json({ code: "EMAIL_TAKEN", message: "Email already registered" });
        return;
      }
      const [u] = await ctx.db
        .insert(users)
        .values({ email: body.email, passwordHash: hashPassword(body.password), locale: body.locale })
        .returning({ id: users.id, email: users.email });
      const tokens = await issueTokens(ctx, u!.id);
      res.status(201).json({ user: u, ...tokens });
    } catch (e) {
      next(e);
    }
  });

  r.post("/auth/login", async (req, res, next) => {
    try {
      const body = loginBody.parse(req.body);
      const [u] = await ctx.db.select().from(users).where(eq(users.email, body.email));
      if (!u || !verifyPassword(body.password, u.passwordHash)) {
        res.status(401).json({ code: "BAD_CREDENTIALS", message: "Wrong email or password" });
        return;
      }
      const tokens = await issueTokens(ctx, u.id);
      res.json({ user: { id: u.id, email: u.email }, ...tokens });
    } catch (e) {
      next(e);
    }
  });

  r.post("/auth/refresh", async (req, res, next) => {
    try {
      const body = refreshBody.parse(req.body);
      const hash = hashToken(body.refreshToken);
      const [row] = await ctx.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash));
      // Reuse detection: an unknown or already-revoked token revokes the whole family.
      if (!row || row.revokedAt) {
        if (row) {
          await ctx.db
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
        }
        res.status(401).json({ code: "INVALID_REFRESH", message: "Refresh token is invalid" });
        return;
      }
      if (row.expiresAt.getTime() < Date.now()) {
        res.status(401).json({ code: "EXPIRED_REFRESH", message: "Refresh token expired" });
        return;
      }
      const next2 = newRefreshToken();
      const [created] = await ctx.db
        .insert(refreshTokens)
        .values({ userId: row.userId, tokenHash: next2.hash, expiresAt: next2.expiresAt })
        .returning({ id: refreshTokens.id });
      await ctx.db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), replacedBy: created!.id })
        .where(eq(refreshTokens.id, row.id));
      const access = await signAccessToken(row.userId);
      res.json({ accessToken: access, refreshToken: next2.token });
    } catch (e) {
      next(e);
    }
  });

  r.post("/auth/logout", async (req, res, next) => {
    try {
      const body = logoutBody.parse(req.body);
      const hash = hashToken(body.refreshToken);
      const [row] = await ctx.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash));
      if (row) {
        if (body.all) {
          await ctx.db
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
        } else {
          await ctx.db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
        }
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
