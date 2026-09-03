import { Router, raw } from "express";
import { and, eq, desc } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
import { createRecordInput, reviewedRecordInput, defaultValidUntil } from "@mfc/shared";
import type { AppContext } from "../../context.js";
import { env } from "../../config/env.js";
import { requireAuth } from "../../auth/middleware.js";
import { encryptOptional, decryptOptional } from "../../crypto/fieldEncryption.js";
import { getStorage } from "../../storage/index.js";
import { medicalRecords } from "../../db/schema.js";

const uid = (req: { userId?: string }) => req.userId as string;
const extFor = (mime: string) => (mime === "image/png" ? "png" : "jpg");

function recordDto(row: typeof medicalRecords.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: decryptOptional(row.titleEnc),
    facility: decryptOptional(row.facilityEnc),
    doctorName: decryptOptional(row.doctorNameEnc),
    doctorLicenseNo: decryptOptional(row.doctorLicenseNoEnc),
    issuedAt: row.issuedAt,
    validUntil: row.validUntil,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    notes: decryptOptional(row.notesEnc),
    createdAt: row.createdAt,
  };
}

async function owned(ctx: AppContext, userId: string, id: string) {
  const [row] = await ctx.db.select().from(medicalRecords).where(and(eq(medicalRecords.id, id), eq(medicalRecords.userId, userId)));
  return row ?? null;
}

export function recordsRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth());

  // Step 1: reserve a record (dedupe by sha256), return where to upload the bytes.
  r.post("/records", async (req, res, next) => {
    try {
      const input = createRecordInput.parse(req.body);
      const dup = await ctx.db
        .select({ id: medicalRecords.id })
        .from(medicalRecords)
        .where(and(eq(medicalRecords.userId, uid(req)), eq(medicalRecords.sha256, input.sha256)));
      if (dup.length > 0) {
        res.status(409).json({ code: "DUPLICATE_RECORD", message: "This document was already added" });
        return;
      }
      const id = randomUUID();
      const storagePath = `${uid(req)}/${id}.${extFor(input.mime)}`;
      await ctx.db.insert(medicalRecords).values({
        id, userId: uid(req), kind: input.kind ?? "other", status: "pending",
        mime: input.mime, sizeBytes: input.sizeBytes, sha256: input.sha256, storagePath,
      });
      res.status(201).json({ recordId: id, uploadUrl: `${env.PUBLIC_BASE_URL}/api/v1/records/${id}/blob` });
    } catch (e) { next(e); }
  });

  // Step 2: upload the image bytes.
  r.put("/records/:id/blob", raw({ type: ["image/jpeg", "image/png"], limit: "10mb" }), async (req, res, next) => {
    try {
      const row = await owned(ctx, uid(req), req.params.id as string);
      if (!row || !row.storagePath) { res.status(404).json({ code: "NOT_FOUND", message: "Record not found" }); return; }
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) { res.status(400).json({ code: "EMPTY_BODY", message: "No image bytes" }); return; }
      const sha = createHash("sha256").update(body).digest("hex");
      if (sha !== row.sha256) { res.status(400).json({ code: "SHA_MISMATCH", message: "Uploaded bytes do not match the declared hash" }); return; }
      await getStorage().put(row.storagePath, body, row.mime ?? "image/jpeg");
      await ctx.db.update(medicalRecords).set({ status: "uploaded", sizeBytes: body.length, updatedAt: new Date() }).where(eq(medicalRecords.id, row.id));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // Step 3: confirm the object is present (server-side normalise/blur-check goes here for Supabase).
  r.post("/records/:id/confirm", async (req, res, next) => {
    try {
      const row = await owned(ctx, uid(req), req.params.id as string);
      if (!row || !row.storagePath) { res.status(404).json({ code: "NOT_FOUND", message: "Record not found" }); return; }
      if (!(await getStorage().exists(row.storagePath))) { res.status(409).json({ code: "NO_BLOB", message: "Upload the image first" }); return; }
      res.json(recordDto(row));
    } catch (e) { next(e); }
  });

  r.get("/records", async (req, res, next) => {
    try {
      const rows = await ctx.db.select().from(medicalRecords).where(eq(medicalRecords.userId, uid(req))).orderBy(desc(medicalRecords.createdAt));
      res.json(rows.map(recordDto));
    } catch (e) { next(e); }
  });

  r.get("/records/:id", async (req, res, next) => {
    try {
      const row = await owned(ctx, uid(req), req.params.id as string);
      if (!row) { res.status(404).json({ code: "NOT_FOUND", message: "Record not found" }); return; }
      res.json(recordDto(row));
    } catch (e) { next(e); }
  });

  r.get("/records/:id/url", async (req, res, next) => {
    try {
      const row = await owned(ctx, uid(req), req.params.id as string);
      if (!row) { res.status(404).json({ code: "NOT_FOUND", message: "Record not found" }); return; }
      res.json({ url: `${env.PUBLIC_BASE_URL}/api/v1/records/${row.id}/blob` });
    } catch (e) { next(e); }
  });

  r.get("/records/:id/blob", async (req, res, next) => {
    try {
      const row = await owned(ctx, uid(req), req.params.id as string);
      if (!row || !row.storagePath) { res.status(404).json({ code: "NOT_FOUND", message: "Record not found" }); return; }
      const buf = await getStorage().get(row.storagePath);
      res.setHeader("Content-Type", row.mime ?? "image/jpeg");
      res.send(buf);
    } catch (e) { next(e); }
  });

  // Save the reviewed fields from the extraction review screen.
  r.put("/records/:id", async (req, res, next) => {
    try {
      const input = reviewedRecordInput.parse(req.body);
      const validUntil = input.validUntil ?? defaultValidUntil(input.kind, input.issuedAt);
      const [row] = await ctx.db
        .update(medicalRecords)
        .set({
          kind: input.kind,
          titleEnc: encryptOptional(input.title),
          facilityEnc: encryptOptional(input.facility),
          doctorNameEnc: encryptOptional(input.doctorName),
          doctorLicenseNoEnc: encryptOptional(input.doctorLicenseNo),
          issuedAt: input.issuedAt ?? null,
          validUntil: validUntil ?? null,
          notesEnc: encryptOptional(input.notes),
          status: "reviewed",
          updatedAt: new Date(),
        })
        .where(and(eq(medicalRecords.id, req.params.id as string), eq(medicalRecords.userId, uid(req))))
        .returning();
      if (!row) { res.status(404).json({ code: "NOT_FOUND", message: "Record not found" }); return; }
      res.json(recordDto(row));
    } catch (e) { next(e); }
  });

  r.delete("/records/:id", async (req, res, next) => {
    try {
      const row = await owned(ctx, uid(req), req.params.id as string);
      if (row?.storagePath) await getStorage().remove(row.storagePath);
      await ctx.db.delete(medicalRecords).where(and(eq(medicalRecords.id, req.params.id as string), eq(medicalRecords.userId, uid(req))));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  return r;
}
