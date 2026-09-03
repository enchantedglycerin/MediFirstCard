import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { extractionSchema } from "@mfc/shared";
import type { AppContext } from "../../context.js";
import { env } from "../../config/env.js";
import { requireAuth } from "../../auth/middleware.js";
import { encryptOptional } from "../../crypto/fieldEncryption.js";
import { medicalRecords, extractions } from "../../db/schema.js";
import { mockExtract } from "./providers/mock.js";
import { buildFieldMeta, hasLowConfidenceField } from "./pipeline.js";

const uid = (req: { userId?: string }) => req.userId as string;

export function extractRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth());

  r.post("/records/:id/extract", async (req, res, next) => {
    try {
      const [record] = await ctx.db
        .select()
        .from(medicalRecords)
        .where(and(eq(medicalRecords.id, req.params.id as string), eq(medicalRecords.userId, uid(req))));
      if (!record) { res.status(404).json({ code: "NOT_FOUND", message: "Record not found" }); return; }

      const provider = env.EXTRACT_PROVIDER;
      let extraction;
      let model: string;
      let source: "live" | "mock";
      if (provider === "gemini" && env.GEMINI_API_KEY) {
        // Wired in the next batch (Typhoon OCR + Gemini). Until then, be honest.
        res.status(501).json({ code: "PROVIDER_NOT_WIRED", message: "Gemini provider not wired yet; set EXTRACT_PROVIDER=mock" });
        return;
      } else {
        ({ extraction, model } = mockExtract());
        source = "mock";
      }

      const parsed = extractionSchema.parse(extraction);
      const fieldMeta = buildFieldMeta(parsed);
      const warnings = source === "mock" ? ["mock provider"] : [];
      const [row] = await ctx.db
        .insert(extractions)
        .values({
          recordId: record.id,
          provider,
          model,
          source,
          extractionJsonEnc: encryptOptional(JSON.stringify(parsed)),
          fieldMeta,
          imageQuality: parsed.image_quality,
        })
        .returning({ id: extractions.id });
      await ctx.db.update(medicalRecords).set({ status: "extracted", updatedAt: new Date() }).where(eq(medicalRecords.id, record.id));

      res.json({
        extractionId: row!.id,
        extraction: parsed,
        fieldMeta,
        needsReview: hasLowConfidenceField(fieldMeta),
        warnings,
        source,
      });
    } catch (e) { next(e); }
  });

  r.post("/records/:id/explain", async (req, res, next) => {
    try {
      const [record] = await ctx.db
        .select({ id: medicalRecords.id })
        .from(medicalRecords)
        .where(and(eq(medicalRecords.id, req.params.id as string), eq(medicalRecords.userId, uid(req))));
      if (!record) { res.status(404).json({ code: "NOT_FOUND", message: "Record not found" }); return; }
      // Gemini text call wires in the next batch; mock keeps the flow demoable.
      res.json({
        answer:
          "เอกสารนี้เป็นใบรับรองแพทย์ ระบุให้พักรักษาตัว 3 วัน หากมีข้อสงสัย โปรดปรึกษาแพทย์หรือเภสัชกร (คำอธิบายตัวอย่าง)",
        source: "mock",
      });
    } catch (e) { next(e); }
  });

  return r;
}
