import type { Extraction } from "@mfc/shared";

// Deterministic extraction for tests, key-less local runs and the provider-down
// demo fallback. One field (doctor_license_no) is deliberately low-confidence so
// the review screen's red-field flow can be demonstrated.
export function mockExtract(): { extraction: Extraction; model: string } {
  const extraction: Extraction = {
    document_type: "medical_certificate_sick_leave",
    language: "th",
    image_quality: "fair",
    patient_name: { value: "สมชาย ใจดี", confidence: 0.92, evidence: "ข้าพเจ้า นายสมชาย ใจดี" },
    hospital: { value: "โรงพยาบาลตัวอย่าง", confidence: 0.88, evidence: "โรงพยาบาลตัวอย่าง" },
    doctor_name: { value: "นพ. วิชัย รักษาดี", confidence: 0.81, evidence: "แพทย์ผู้ตรวจ นพ. วิชัย รักษาดี" },
    doctor_license_no: { value: "ว.12345", confidence: 0.44, evidence: "ว.1234?" }, // smudged -> red
    visit_date: { value: "2026-09-03", confidence: 0.9, evidence: "3 กันยายน 2569" },
    diagnosis: { value: "ไข้หวัดใหญ่", confidence: 0.86, evidence: "วินิจฉัย: ไข้หวัดใหญ่" },
    icd10_codes: [{ value: "J11.1", confidence: 0.7, evidence: "J11.1" }],
    medications: [
      { name: "Paracetamol", strength: "500mg", dose: "1 เม็ด", frequency: "วันละ 3 ครั้ง หลังอาหาร", duration: "5 วัน", confidence: 0.83, evidence: "Paracetamol 500mg 1 เม็ด วันละ 3 ครั้ง" },
    ],
    rest_days: { value: 3, confidence: 0.9, evidence: "ควรพักรักษาตัว 3 วัน" },
    rest_from: { value: "2026-09-03", confidence: 0.88, evidence: "ตั้งแต่วันที่ 3 ก.ย. 2569" },
    rest_to: { value: "2026-09-05", confidence: 0.88, evidence: "ถึงวันที่ 5 ก.ย. 2569" },
    follow_up_date: { value: null, confidence: 0, evidence: null },
    notes: { value: null, confidence: 0, evidence: null },
    warnings: [],
  };
  return { extraction, model: "mock-1" };
}
