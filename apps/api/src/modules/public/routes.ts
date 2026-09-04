import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
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
import { getStorage } from "../../storage/index.js";
import { renderEmergencyPage, renderClinicianPage, renderPasscodeForm } from "./html.js";

const lang = (req: { query: Record<string, unknown> }): "th" | "en" => (req.query.lang === "en" ? "en" : "th");

type ShareRow = typeof shareLinks.$inferSelect;

/** Images on a clinician page are fetched by the browser without the passcode, so each URL carries a short-lived signature bound to the link. */
const IMAGE_TTL_MS = 6 * 60 * 60 * 1000;
const imageKey = () => env.JWT_SECRET ?? env.FIELD_ENC_KEY ?? "medifirstcard-dev";
function imageSig(linkId: string, recordId: string, exp: number): string {
  return createHmac("sha256", imageKey()).update(`${linkId}:${recordId}:${exp}`).digest("base64url");
}
function imageSigOk(linkId: string, recordId: string, exp: number, sig: string): boolean {
  const want = Buffer.from(imageSig(linkId, recordId, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

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

  async function renderRecords(ctx2: AppContext, row: ShareRow, token: string, l: "th" | "en"): Promise<string> {
    const ids = row.recordIds ?? [];
    const rows = ids.length
      ? await ctx2.db.select().from(medicalRecords).where(and(eq(medicalRecords.userId, row.userId), inArray(medicalRecords.id, ids)))
      : [];
    rows.sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? "") || b.createdAt.getTime() - a.createdAt.getTime());
    const card = await buildCardForUser(ctx2, row.userId).catch(() => null);
    const ownerName = card?.lines.find((line) => line.kind === "identity")?.value ?? null;
    const exp = Date.now() + IMAGE_TTL_MS;
    return renderClinicianPage({
      lang: l,
      ownerName,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      records: rows.map((rec) => ({
        kind: rec.kind,
        title: decryptOptional(rec.titleEnc),
        facility: decryptOptional(rec.facilityEnc),
        doctorName: decryptOptional(rec.doctorNameEnc),
        doctorLicenseNo: decryptOptional(rec.doctorLicenseNoEnc),
        issuedAt: rec.issuedAt,
        validUntil: rec.validUntil,
        notes: decryptOptional(rec.notesEnc),
        status: rec.status,
        createdAt: rec.createdAt.toISOString(),
        imageUrl: rec.storagePath ? `/s/${token}/records/${rec.id}/image?exp=${exp}&sig=${imageSig(row.id, rec.id, exp)}` : null,
      })),
    });
  }

  // The scanned document itself, for <img> tags on the clinician page. Needs a live link and a valid signature.
  r.get("/s/:token/records/:recordId/image", async (req, res, next) => {
    try {
      const row = await records(req.params.token as string);
      if (!row || !usable(row)) { res.status(410).type("text").send("This link has expired."); return; }
      const recordId = req.params.recordId as string;
      const exp = Number(req.query.exp);
      const sig = String(req.query.sig ?? "");
      if (!(row.recordIds ?? []).includes(recordId) || !Number.isFinite(exp) || exp < Date.now() || !imageSigOk(row.id, recordId, exp, sig)) {
        res.status(403).type("text").send("Image link is not valid.");
        return;
      }
      const [rec] = await ctx.db.select().from(medicalRecords).where(and(eq(medicalRecords.id, recordId), eq(medicalRecords.userId, row.userId)));
      if (!rec || !rec.storagePath) { res.status(404).type("text").send("No image."); return; }
      const buf = await getStorage().get(rec.storagePath);
      res.setHeader("Content-Type", rec.mime ?? "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(buf);
    } catch (e) { next(e); }
  });

  r.get("/s/:token", async (req, res, next) => {
    try {
      const row = await records(req.params.token as string);
      if (!row) { res.status(404).type("html").send("<p>Link not found.</p>"); return; }
      if (!usable(row)) { await log(ctx, req, row.id, row.revokedAt ? "revoked" : "expired"); res.status(410).type("html").send("<p>This link has expired.</p>"); return; }
      if (row.passcodeHash) { res.type("html").send(renderPasscodeForm({ token: req.params.token as string, lang: lang(req) })); return; }
      await ctx.db.update(shareLinks).set({ viewCount: row.viewCount + 1 }).where(eq(shareLinks.id, row.id));
      await log(ctx, req, row.id, "ok");
      await recordView(ctx, { userId: row.userId, kind: "share_viewed", meta: { via: "web" } });
      res.type("html").send(await renderRecords(ctx, row, req.params.token as string, lang(req)));
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
      res.type("html").send(await renderRecords(ctx, row, req.params.token as string, lang(req)));
    } catch (e) { next(e); }
  });

  return r;
}
