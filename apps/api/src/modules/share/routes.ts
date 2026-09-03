import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { createShareLinkInput } from "@mfc/shared";
import type { AppContext } from "../../context.js";
import { env } from "../../config/env.js";
import { requireAuth } from "../../auth/middleware.js";
import { hashPassword } from "../../crypto/password.js";
import { hashToken } from "../../auth/tokens.js";
import { shareLinks, shareAccessLog } from "../../db/schema.js";

const uid = (req: { userId?: string }) => req.userId as string;

export function shareRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth());

  // Clinician (records-scope) link. The token is returned once; only its hash is stored.
  r.post("/share-links", async (req, res, next) => {
    try {
      const input = createShareLinkInput.parse(req.body);
      const token = randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + input.ttlHours * 60 * 60 * 1000);
      const [row] = await ctx.db
        .insert(shareLinks)
        .values({
          userId: uid(req), scope: "records", tokenHash: hashToken(token), token: null,
          recordIds: input.recordIds, expiresAt,
          passcodeHash: input.passcode ? hashPassword(input.passcode) : null,
          maxViews: input.maxViews ?? null,
        })
        .returning({ id: shareLinks.id, expiresAt: shareLinks.expiresAt });
      res.status(201).json({ id: row!.id, url: `${env.PUBLIC_BASE_URL}/s/${token}`, expiresAt: row!.expiresAt });
    } catch (e) { next(e); }
  });

  r.get("/share-links", async (req, res, next) => {
    try {
      const rows = await ctx.db
        .select({
          id: shareLinks.id, scope: shareLinks.scope, expiresAt: shareLinks.expiresAt,
          revokedAt: shareLinks.revokedAt, viewCount: shareLinks.viewCount, maxViews: shareLinks.maxViews,
          createdAt: shareLinks.createdAt,
        })
        .from(shareLinks)
        .where(and(eq(shareLinks.userId, uid(req)), eq(shareLinks.scope, "records")))
        .orderBy(desc(shareLinks.createdAt));
      res.json(rows);
    } catch (e) { next(e); }
  });

  r.post("/share-links/:id/revoke", async (req, res, next) => {
    try {
      const [row] = await ctx.db
        .update(shareLinks).set({ revokedAt: new Date() })
        .where(and(eq(shareLinks.id, req.params.id as string), eq(shareLinks.userId, uid(req)))).returning({ id: shareLinks.id });
      if (!row) { res.status(404).json({ code: "NOT_FOUND", message: "Link not found" }); return; }
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get("/share-links/:id/log", async (req, res, next) => {
    try {
      const [own] = await ctx.db.select({ id: shareLinks.id }).from(shareLinks)
        .where(and(eq(shareLinks.id, req.params.id as string), eq(shareLinks.userId, uid(req))));
      if (!own) { res.status(404).json({ code: "NOT_FOUND", message: "Link not found" }); return; }
      const rows = await ctx.db.select().from(shareAccessLog)
        .where(eq(shareAccessLog.shareLinkId, req.params.id as string)).orderBy(desc(shareAccessLog.accessedAt));
      res.json(rows);
    } catch (e) { next(e); }
  });

  return r;
}
