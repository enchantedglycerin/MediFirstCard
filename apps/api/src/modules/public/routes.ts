import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import QRCode from "qrcode";
import type { AppContext } from "../../context.js";
import { env } from "../../config/env.js";
import { hashToken } from "../../auth/tokens.js";
import { verifyPassword } from "../../crypto/password.js";
import { shareLinks, shareAccessLog, medicalRecords } from "../../db/schema.js";
import { decryptOptional } from "../../crypto/fieldEncryption.js";
import { buildCardForUser } from "../profile/service.js";
import { recordView } from "../alerts/service.js";
import { renderEmergencyPage, renderClinicianPage, renderPasscodeForm } from "./html.js";

const lang = (req: { query: Record<string, unknown> }): "th" | "en" => (req.query.lang === "en" ? "en" : "th");

type ShareRow = typeof shareLinks.$inferSelect;

function usable(row: ShareRow): boolean {
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return false;
  if (row.maxViews != null && row.viewCount >= row.maxViews) return false;
  return true;
}

async function log(ctx: AppContext, req: { ip?: string; headers: Record<string, unknown> }, linkId: string, outcome: "ok" | "expired" | "revoked" | "not_found" | "bad_passcode") {
  await ctx.db.insert(shareAccessLog).values({
    shareLinkId: linkId,
    ip: req.ip ?? null,
    userAgent: (req.headers["user-agent"] as string) ?? null,
    outcome,
  });
}

export function publicRoutes(ctx: AppContext): Router {
  const r = Router();

  // Register more specific routes before /e/:token.
  r.get("/e/:token/qr.png", async (req, res, next) => {
    try {
      const url = `${env.PUBLIC_BASE_URL}/e/${req.params.token}`;
      const png = await QRCode.toBuffer(url, { margin: 1, width: 320 });
      res.setHeader("Content-Type", "image/png");
      res.send(png);
    } catch (e) { next(e); }
  });

  async function emergency(token: string): Promise<ShareRow | null> {
    const [row] = await ctx.db.select().from(shareLinks).where(and(eq(shareLinks.tokenHash, hashToken(token)), eq(shareLinks.scope, "emergency")));
    return row ?? null;
  }

  r.get("/e/:token.json", async (req, res, next) => {
    try {
      const row = await emergency(req.params.token as string);
      if (!row || !usable(row)) { res.status(404).json({ code: "NOT_FOUND", message: "Card not available" }); return; }
      const payload = await buildCardForUser(ctx, row.userId);
      await log(ctx, req, row.id, "ok");
      await recordView(ctx, { userId: row.userId, kind: "card_viewed", meta: { via: "json", ua: req.headers["user-agent"] ?? null } });
      res.json({ lines: payload.lines, lastReviewedAt: payload.lastReviewedAt });
    } catch (e) { next(e); }
  });

  r.get("/e/:token", async (req, res, next) => {
    try {
      const row = await emergency(req.params.token as string);
      if (!row || !usable(row)) { res.status(404).type("html").send("<p>Card not available.</p>"); return; }
      const payload = await buildCardForUser(ctx, row.userId);
      const name = payload.lines.find((l) => l.kind === "identity")?.value ?? null;
      await log(ctx, req, row.id, "ok");
      await recordView(ctx, { userId: row.userId, kind: "card_viewed", meta: { via: "web", ua: req.headers["user-agent"] ?? null } });
      res.type("html").send(renderEmergencyPage({ name, lines: payload.lines, lastReviewedAt: payload.lastReviewedAt, lang: lang(req) }));
    } catch (e) { next(e); }
  });

  async function records(token: string): Promise<ShareRow | null> {
    const [row] = await ctx.db.select().from(shareLinks).where(and(eq(shareLinks.tokenHash, hashToken(token)), eq(shareLinks.scope, "records")));
    return row ?? null;
  }

  async function renderRecords(ctx2: AppContext, row: ShareRow, l: "th" | "en"): Promise<string> {
    const ids = row.recordIds ?? [];
    const rows = ids.length
      ? await ctx2.db.select().from(medicalRecords).where(and(eq(medicalRecords.userId, row.userId), inArray(medicalRecords.id, ids)))
      : [];
    return renderClinicianPage({
      lang: l,
      records: rows.map((rec) => ({ kind: rec.kind, facility: decryptOptional(rec.facilityEnc), issuedAt: rec.issuedAt, validUntil: rec.validUntil })),
    });
  }

  r.get("/s/:token", async (req, res, next) => {
    try {
      const row = await records(req.params.token as string);
      if (!row) { res.status(404).type("html").send("<p>Link not found.</p>"); return; }
      if (!usable(row)) { await log(ctx, req, row.id, row.revokedAt ? "revoked" : "expired"); res.status(410).type("html").send("<p>This link has expired.</p>"); return; }
      if (row.passcodeHash) { res.type("html").send(renderPasscodeForm({ token: req.params.token as string, lang: lang(req) })); return; }
      await ctx.db.update(shareLinks).set({ viewCount: row.viewCount + 1 }).where(eq(shareLinks.id, row.id));
      await log(ctx, req, row.id, "ok");
      await recordView(ctx, { userId: row.userId, kind: "share_viewed", meta: { via: "web" } });
      res.type("html").send(await renderRecords(ctx, row, lang(req)));
    } catch (e) { next(e); }
  });

  r.post("/s/:token", async (req, res, next) => {
    try {
      const row = await records(req.params.token as string);
      if (!row) { res.status(404).type("html").send("<p>Link not found.</p>"); return; }
      if (!usable(row)) { res.status(410).type("html").send("<p>This link has expired.</p>"); return; }
      const passcode = String((req.body as Record<string, unknown>)?.passcode ?? "");
      if (!row.passcodeHash || !verifyPassword(passcode, row.passcodeHash)) {
        const failed = row.failedPasscodes + 1;
        if (failed >= 5) {
          await ctx.db.update(shareLinks).set({ failedPasscodes: failed, revokedAt: new Date() }).where(eq(shareLinks.id, row.id));
          await log(ctx, req, row.id, "bad_passcode");
          await recordView(ctx, { userId: row.userId, kind: "share_revoked", meta: { reason: "too_many_passcode_failures" } });
          res.status(410).type("html").send("<p>Too many attempts. This link has been revoked.</p>");
          return;
        }
        await ctx.db.update(shareLinks).set({ failedPasscodes: failed }).where(eq(shareLinks.id, row.id));
        await log(ctx, req, row.id, "bad_passcode");
        res.status(401).type("html").send(renderPasscodeForm({ token: req.params.token as string, lang: lang(req), error: true }));
        return;
      }
      await ctx.db.update(shareLinks).set({ viewCount: row.viewCount + 1, failedPasscodes: 0 }).where(eq(shareLinks.id, row.id));
      await log(ctx, req, row.id, "ok");
      await recordView(ctx, { userId: row.userId, kind: "share_viewed", meta: { via: "web" } });
      res.type("html").send(await renderRecords(ctx, row, lang(req)));
    } catch (e) { next(e); }
  });

  return r;
}
