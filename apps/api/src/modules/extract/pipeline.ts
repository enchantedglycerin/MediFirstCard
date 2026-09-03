import type { Extraction } from "@mfc/shared";

export type ConfidenceBand = "high" | "medium" | "low" | "none";

export function band(confidence: number, hasValue: boolean): ConfidenceBand {
  if (!hasValue) return "none";
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

// Flatten an extraction into per-field {confidence, band} so the review screen can
// colour each chip and force the user to confirm red (low) fields.
export function buildFieldMeta(extraction: Extraction): Record<string, { confidence: number; band: ConfidenceBand }> {
  const meta: Record<string, { confidence: number; band: ConfidenceBand }> = {};
  const put = (key: string, value: unknown, confidence: number) => {
    meta[key] = { confidence, band: band(confidence, value !== null && value !== undefined) };
  };
  put("patient_name", extraction.patient_name.value, extraction.patient_name.confidence);
  put("hospital", extraction.hospital.value, extraction.hospital.confidence);
  put("doctor_name", extraction.doctor_name.value, extraction.doctor_name.confidence);
  put("doctor_license_no", extraction.doctor_license_no.value, extraction.doctor_license_no.confidence);
  put("visit_date", extraction.visit_date.value, extraction.visit_date.confidence);
  put("diagnosis", extraction.diagnosis.value, extraction.diagnosis.confidence);
  put("rest_days", extraction.rest_days.value, extraction.rest_days.confidence);
  put("rest_from", extraction.rest_from.value, extraction.rest_from.confidence);
  put("rest_to", extraction.rest_to.value, extraction.rest_to.confidence);
  put("follow_up_date", extraction.follow_up_date.value, extraction.follow_up_date.confidence);
  extraction.medications.forEach((m, i) => put(`medication_${i}`, m.name, m.confidence));
  return meta;
}

export function hasLowConfidenceField(meta: Record<string, { band: ConfidenceBand }>): boolean {
  return Object.values(meta).some((m) => m.band === "low");
}
