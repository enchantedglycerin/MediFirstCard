import { z } from "zod";

// Every field is {value, confidence, evidence} so a single model call yields both
// the per-field confidence score and the explainability snippet. Mirrors
// docs/research/research-ocr-ai.md §6 and research-free-ocr.md.

const strField = z.object({
  value: z.string().nullable(),
  confidence: z.number(),
  evidence: z.string().nullable(),
});

const intField = z.object({
  value: z.number().int().nullable(),
  confidence: z.number(),
  evidence: z.string().nullable(),
});

const medicationField = z.object({
  name: z.string().nullable(),
  strength: z.string().nullable(),
  dose: z.string().nullable(),
  frequency: z.string().nullable(),
  duration: z.string().nullable(),
  confidence: z.number(),
  evidence: z.string().nullable(),
});

export const documentType = z.enum([
  "medical_certificate_sick_leave",
  "medical_certificate_5_disease",
  "prescription",
  "medication_label",
  "lab_result",
  "receipt",
  "other_medical",
  "not_medical",
]);

export const extractionSchema = z.object({
  document_type: documentType,
  language: z.enum(["th", "en", "mixed", "other"]),
  image_quality: z.enum(["good", "fair", "poor"]),
  patient_name: strField,
  hospital: strField,
  doctor_name: strField,
  doctor_license_no: strField,
  visit_date: strField,
  diagnosis: strField,
  icd10_codes: z.array(strField),
  medications: z.array(medicationField),
  rest_days: intField,
  rest_from: strField,
  rest_to: strField,
  follow_up_date: strField,
  notes: strField,
  warnings: z.array(z.string()),
});

export type Extraction = z.infer<typeof extractionSchema>;

// Plain JSON Schema for Gemini's responseJsonSchema (do NOT use minimum/maximum;
// enforce the 0..1 confidence range in code). $defs/$ref are supported by Gemini.
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  $defs: {
    strField: {
      type: "object",
      additionalProperties: false,
      required: ["value", "confidence", "evidence"],
      properties: {
        value: { type: ["string", "null"] },
        confidence: { type: "number", description: "0.0-1.0, how certain the value is read correctly" },
        evidence: { type: ["string", "null"], description: "verbatim source text, max 120 chars" },
      },
    },
    intField: {
      type: "object",
      additionalProperties: false,
      required: ["value", "confidence", "evidence"],
      properties: {
        value: { type: ["integer", "null"] },
        confidence: { type: "number" },
        evidence: { type: ["string", "null"] },
      },
    },
  },
  required: [
    "document_type", "language", "image_quality", "patient_name", "hospital",
    "doctor_name", "doctor_license_no", "visit_date", "diagnosis", "icd10_codes",
    "medications", "rest_days", "rest_from", "rest_to", "follow_up_date", "notes", "warnings",
  ],
  properties: {
    document_type: {
      type: "string",
      enum: [
        "medical_certificate_sick_leave", "medical_certificate_5_disease", "prescription",
        "medication_label", "lab_result", "receipt", "other_medical", "not_medical",
      ],
    },
    language: { type: "string", enum: ["th", "en", "mixed", "other"] },
    image_quality: { type: "string", enum: ["good", "fair", "poor"] },
    patient_name: { $ref: "#/$defs/strField" },
    hospital: { $ref: "#/$defs/strField" },
    doctor_name: { $ref: "#/$defs/strField" },
    doctor_license_no: { $ref: "#/$defs/strField" },
    visit_date: { $ref: "#/$defs/strField" },
    diagnosis: { $ref: "#/$defs/strField" },
    icd10_codes: { type: "array", items: { $ref: "#/$defs/strField" } },
    medications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "strength", "dose", "frequency", "duration", "confidence", "evidence"],
        properties: {
          name: { type: ["string", "null"] },
          strength: { type: ["string", "null"] },
          dose: { type: ["string", "null"] },
          frequency: { type: ["string", "null"] },
          duration: { type: ["string", "null"] },
          confidence: { type: "number" },
          evidence: { type: ["string", "null"] },
        },
      },
    },
    rest_days: { $ref: "#/$defs/intField" },
    rest_from: { $ref: "#/$defs/strField" },
    rest_to: { $ref: "#/$defs/strField" },
    follow_up_date: { $ref: "#/$defs/strField" },
    notes: { $ref: "#/$defs/strField" },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

export const EXTRACTION_SYSTEM_PROMPT = `You are a medical-document extraction engine for a Thai patient app. Input: one photo of a Thai and/or English medical document (medical certificate ใบรับรองแพทย์, prescription, medicine label, lab result, receipt) or a non-medical image.
Rules:
1. Output ONLY JSON matching the provided schema. Never invent values: if a field is not visible, set value to null and confidence to 0.
2. For every field give "evidence": the exact source text you read (verbatim, original language, max 120 chars) and "confidence" 0.0-1.0 reflecting legibility and certainty.
3. Dates: return ISO 8601 (YYYY-MM-DD). Thai Buddhist Era years (พ.ศ., or years > 2400) must be converted by subtracting 543; keep the original string in evidence.
4. Keep Thai text in Thai; do not translate the diagnosis.
5. Doctor licence numbers look like "ว.12345". ICD-10 codes look like J06.9; only output a code that is printed.
6. Medications: one entry per drug with name, strength, dose, frequency (as printed), duration/quantity.
7. If the image is not a medical document set document_type = "not_medical" and leave other fields null. If text is unreadable set image_quality = "poor" and explain in "warnings".
8. This is an educational prototype; do not add medical advice.`;
