import { z } from "zod";

export const bloodAbo = z.enum(["A", "B", "AB", "O", "unknown"]);
export const bloodRh = z.enum(["pos", "neg", "unknown"]);
export const sex = z.enum(["male", "female", "other", "unspecified"]);
export const insuranceScheme = z.enum(["ucs", "sss", "csmbs", "private", "self_pay", "unknown"]);
export const allergySeverity = z.enum(["mild", "moderate", "severe"]);
export const allergyCategory = z.enum(["medication", "food", "environment"]);
export const allergySource = z.enum(["self", "hospital_card"]);
export const conditionStatus = z.enum(["active", "resolved"]);

// Thai national ID: 13 digits with a mod-11 checksum.
export function isValidThaiId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  return check === Number(id[12]);
}

export const thaiIdField = z
  .string()
  .refine((v) => v === "" || isValidThaiId(v), { message: "invalid_thai_id" })
  .optional();

// Thai phone: 0 followed by 8-9 digits (spaces and hyphens are stripped before validation).
export function normalizePhone(v: string): string {
  return v.replace(/[\s-]/g, "");
}
export const phoneField = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^0\d{8,9}$/, "invalid_phone"));

export const allergyInput = z.object({
  substanceEn: z.string().max(120).optional(),
  substanceTh: z.string().max(120).optional(),
  category: allergyCategory.default("medication"),
  reaction: z.string().max(200).optional(),
  severity: allergySeverity.default("moderate"),
  source: allergySource.default("self"),
});

export const conditionInput = z.object({
  code: z.string().max(10).optional(), // ICD-10, kept plain for filtering
  labelTh: z.string().max(120).optional(),
  labelEn: z.string().max(120).optional(),
  status: conditionStatus.default("active"),
  onsetYear: z.number().int().min(1900).max(2200).optional(),
  critical: z.boolean().default(false),
});

export const medicationInput = z.object({
  name: z.string().min(1).max(120),
  strength: z.string().max(60).optional(),
  dose: z.string().max(120).optional(),
  frequencyTh: z.string().max(120).optional(),
  critical: z.boolean().default(false),
});

export const contactInput = z.object({
  name: z.string().min(1).max(120),
  relationship: z.string().max(60).optional(),
  phone: z.string().regex(/^0\d{8,9}$/, "invalid_phone"),
  informedConsent: z.boolean().default(false),
  priority: z.number().int().min(1).max(5).default(1),
});

export const profileFlags = z.object({
  anticoagulant: z.boolean().default(false),
  insulin: z.boolean().default(false),
  pacemaker: z.boolean().default(false),
  dialysis: z.boolean().default(false),
  pregnancy: z.boolean().default(false),
});

export const DEFAULT_FLAGS = {
  anticoagulant: false,
  insulin: false,
  pacemaker: false,
  dialysis: false,
  pregnancy: false,
};

export const lockScreenFieldsSchema = z.object({
  name: z.boolean(),
  bloodType: z.boolean(),
  allergies: z.boolean(),
  conditions: z.boolean(),
  medications: z.boolean(),
  contact: z.boolean(),
});

export const emergencyProfileInput = z.object({
  firstNameTh: z.string().max(120).optional(),
  lastNameTh: z.string().max(120).optional(),
  nameEn: z.string().max(160).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date").optional(),
  sex: sex.default("unspecified"),
  bloodAbo: bloodAbo.default("unknown"),
  bloodRh: bloodRh.default("unknown"),
  noKnownDrugAllergy: z.boolean().default(false),
  flags: profileFlags.default(DEFAULT_FLAGS),
  insuranceScheme: insuranceScheme.default("unknown"),
  preferredLanguage: z.enum(["th", "en"]).default("th"),
  notes: z.string().max(2000).optional(),
});

export type EmergencyProfileInput = z.infer<typeof emergencyProfileInput>;
export type AllergyInput = z.infer<typeof allergyInput>;
export type ConditionInput = z.infer<typeof conditionInput>;
export type MedicationInput = z.infer<typeof medicationInput>;
export type ContactInput = z.infer<typeof contactInput>;
export type LockScreenFieldsInput = z.infer<typeof lockScreenFieldsSchema>;
