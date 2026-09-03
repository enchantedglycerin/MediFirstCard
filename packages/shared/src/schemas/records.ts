import { z } from "zod";

export const recordKind = z.enum([
  "certificate_general",
  "certificate_driving",
  "certificate_5disease",
  "sick_leave",
  "prescription",
  "lab",
  "vaccine",
  "allergy_card",
  "discharge",
  "receipt",
  "other",
]);

export const recordStatus = z.enum(["pending", "uploaded", "extracted", "reviewed"]);

export const allowedMime = z.enum(["image/jpeg", "image/png"]);

// Step 1 of upload: client sends metadata + the SHA-256 it computed, gets a signed URL back.
export const createRecordInput = z.object({
  kind: recordKind.optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "invalid_sha256"),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  mime: allowedMime,
});

// Step 3: reviewed fields the user confirmed on the review screen.
export const reviewedRecordInput = z.object({
  kind: recordKind,
  title: z.string().max(200).optional(),
  facility: z.string().max(200).optional(),
  doctorName: z.string().max(160).optional(),
  doctorLicenseNo: z.string().max(40).optional(),
  issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateRecordInput = z.infer<typeof createRecordInput>;
export type ReviewedRecordInput = z.infer<typeof reviewedRecordInput>;
export type RecordKind = z.infer<typeof recordKind>;

// Extraction document_type -> record kind (PLAN §5).
const KIND_BY_DOCTYPE: Record<string, RecordKind | null> = {
  medical_certificate_sick_leave: "sick_leave",
  medical_certificate_5_disease: "certificate_5disease",
  prescription: "prescription",
  medication_label: "prescription",
  lab_result: "lab",
  receipt: "receipt",
  other_medical: "other",
  not_medical: null, // no kind change; app offers manual entry
};

export function kindFromDocumentType(documentType: string): RecordKind | null {
  // A key that is present maps to its value (including the explicit null for
  // not_medical); an unknown key falls back to "other".
  if (documentType in KIND_BY_DOCTYPE) return KIND_BY_DOCTYPE[documentType] ?? null;
  return "other";
}

/** Certificates default to a 1-month validity from the issue date (Medical Council rule). */
export function defaultValidUntil(kind: RecordKind, issuedAt?: string): string | undefined {
  if (!issuedAt) return undefined;
  const needsValidity = kind.startsWith("certificate_") || kind === "sick_leave";
  if (!needsValidity) return undefined;
  const d = new Date(issuedAt + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
