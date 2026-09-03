import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { requireAuth } from "../../auth/middleware.js";
import { getStorage } from "../../storage/index.js";
import { users, consents, shareLinks, medicalRecords, deletedUsers } from "../../db/schema.js";

const uid = (req: { userId?: string }) => req.userId as string;

const consentBody = z.object({
  version: z.number().int().min(1),
  purposes: z.record(z.string(), z.boolean()),
  granted: z.boolean(),
});

export function consentRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth());

  r.post("/me/consent", async (req, res, next) => {
    try {
      const body = consentBody.parse(req.body);
      await ctx.db.insert(consents).values({ userId: uid(req), version: body.version, purposes: body.purposes, granted: body.granted });
      if (body.granted) {
        await ctx.db.update(users).set({ consentVersion: body.version, consentedAt: new Date() }).where(eq(users.id, uid(req)));
      } else {
        // Withdrawal revokes all active share links (PLAN §11).
        await ctx.db.update(shareLinks).set({ revokedAt: new Date() }).where(eq(shareLinks.userId, uid(req)));
      }
      res.status(201).json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get("/me/consent", async (req, res, next) => {
    try {
      const [latest] = await ctx.db.select().from(consents).where(eq(consents.userId, uid(req))).orderBy(desc(consents.at)).limit(1);
      res.json(latest ?? null);
    } catch (e) { next(e); }
  });

  // Right to erasure: hard-delete the user (cascades to all data) + storage + tombstone.
  r.delete("/me", async (req, res, next) => {
    try {
      const [u] = await ctx.db.select({ email: users.email }).from(users).where(eq(users.id, uid(req)));
      if (!u) { res.json({ ok: true }); return; }
      const recs = await ctx.db.select({ path: medicalRecords.storagePath }).from(medicalRecords).where(eq(medicalRecords.userId, uid(req)));
      for (const rec of recs) {
        if (rec.path) { try { await getStorage().remove(rec.path); } catch { /* best-effort */ } }
      }
      await ctx.db.insert(deletedUsers).values({ emailHash: createHash("sha256").update(u.email).digest("hex") });
      await ctx.db.delete(users).where(eq(users.id, uid(req))); // FK cascade removes the rest
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  return r;
}
