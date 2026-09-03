# Synthetic sample documents

Three fictional Thai medical documents for demos, screenshots and tests. Every name, hospital, licence number, ID number and result is invented; each image carries a diagonal "SAMPLE – ตัวอย่าง – ไม่ใช่เอกสารจริง" watermark and a footer saying it is synthetic.

| File | Document | What the extractor should find |
|---|---|---|
| `01-sick-leave-certificate.png` | ใบรับรองแพทย์ (Medical Council style sick-leave certificate) | patient นายสมชาย ใจดี, hospital โรงพยาบาลตัวอย่าง, doctor นพ. วิชัย รักษาดี, licence ว.12345, visit 2026-09-03, diagnosis ไข้หวัดใหญ่ J11.1, rest 3 days 2026-09-03 → 2026-09-05, Paracetamol 500 mg |
| `02-prescription.png` | ใบสั่งยา (prescription) | patient นางสาววิไล ใจดี, allergy Penicillin, Cetirizine 10 mg, Fluticasone spray, Paracetamol 500 mg, doctor พญ. สุดา เมตตา ว.67890 |
| `03-lab-report.png` | ผลการตรวจทางห้องปฏิบัติการ (CBC / chemistry) | patient นายสมชาย ใจดี, blood group O Rh-negative, six normal results |

Why synthetic: the free tiers of Google Gemini and SCB 10X Typhoon may use inputs to improve their services, so no real document is ever sent. Regenerate with `scripts` in the session notes (PowerShell + System.Drawing) or edit the PNGs directly.

For the phone demo: `adb push docs/samples/01-sick-leave-certificate.png /sdcard/Pictures/` then open the Gallery once so it is indexed.
