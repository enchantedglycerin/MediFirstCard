import { EMERGENCY_NUMBER, dialable, type CardLine } from "@mfc/shared";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

const DISCLAIMER_TH = "ข้อมูลในบัตรนี้ผู้ใช้กรอกเอง ยังไม่ได้ตรวจสอบจากโรงพยาบาล บุคลากรทางการแพทย์ต้องยืนยันหมู่เลือด ประวัติแพ้ยา และยาที่ใช้ตามขั้นตอนมาตรฐาน";
const DISCLAIMER_EN = "Self-reported and not hospital-verified. Medical staff must confirm blood group, allergies and medications by standard procedures.";

function shell(title: string, lang: "th" | "en", body: string, otherLang: string): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{color-scheme:light dark}
body{margin:0;font:18px/1.5 -apple-system,"Segoe UI",Tahoma,sans-serif;background:#f4f6f9;color:#16181b}
.wrap{max-width:520px;margin:0 auto;padding:16px}
.card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.head{background:#C62828;color:#fff;padding:16px 18px}
.head h1{margin:0;font-size:20px}
.blood{display:inline-block;margin-top:6px;font-size:28px;font-weight:800}
.row{padding:12px 18px;border-bottom:1px solid #eef1f4}
.row:last-child{border-bottom:0}
.label{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#5b6370}
.value{font-size:22px;font-weight:600}
.urgent .value{color:#B3261E}
a.call{display:inline-block;margin-top:4px;color:#005B96;font-weight:600;text-decoration:none}
a.ems{display:block;margin:12px 0;padding:14px;border-radius:12px;background:#C62828;color:#fff;text-align:center;font-size:20px;font-weight:700;text-decoration:none}
.foot{padding:14px 18px;font-size:13px;color:#5b6370;background:#fbfbfd}
.toggle{display:block;text-align:right;margin:0 0 10px;font-size:14px}
.disc{margin-top:8px}
@media(prefers-color-scheme:dark){body{background:#0f1418;color:#e6e9ed}.card{background:#171d23}.row{border-color:#2a333d}.foot{background:#131a20;color:#a5aeb8}.label{color:#a5aeb8}}
</style></head><body><div class="wrap">
<a class="toggle" href="?lang=${otherLang}">${otherLang === "en" ? "English" : "ภาษาไทย"}</a>
${body}
</div></body></html>`;
}

export function renderEmergencyPage(opts: {
  name: string | null;
  lines: CardLine[];
  lastReviewedAt: string | null;
  lang: "th" | "en";
}): string {
  const { lang } = opts;
  const t = lang === "th"
    ? { title: "บัตรฉุกเฉิน", reviewed: "ปรับปรุงล่าสุด", ems: "โทร 1669 (แพทย์ฉุกเฉิน)" }
    : { title: "Emergency Card", reviewed: "Last updated", ems: "Call 1669 (Emergency medical service)" };
  const blood = opts.lines.find((l) => l.kind === "blood");
  const rows = opts.lines
    .filter((l) => l.kind !== "blood")
    .map((l) => `<div class="row ${l.urgent ? "urgent" : ""}">
      <div class="label">${esc(l.label)}</div>
      <div class="value">${esc(l.value)}</div>
      ${l.kind === "contact" ? `<a class="call" href="tel:${esc(l.phone ?? dialable(l.value))}">📞 ${lang === "th" ? "โทร" : "Call"}</a>` : ""}
    </div>`)
    .join("");
  const body = `<a class="ems" href="tel:${EMERGENCY_NUMBER}">🚑 ${t.ems}</a><div class="card">
    <div class="head"><h1>${esc(opts.name ?? t.title)}</h1>${blood ? `<div class="blood">${esc(blood.value)}</div>` : ""}</div>
    ${rows || `<div class="row"><div class="value">—</div></div>`}
    <div class="foot"><div>${t.reviewed}: ${esc(opts.lastReviewedAt ?? "—")}</div>
      <div class="disc">${lang === "th" ? DISCLAIMER_TH : DISCLAIMER_EN}</div></div>
  </div>`;
  return shell(t.title, lang, body, lang === "th" ? "en" : "th");
}

export function renderClinicianPage(opts: {
  records: Array<{ kind: string; facility: string | null; issuedAt: string | null; validUntil: string | null }>;
  lang: "th" | "en";
}): string {
  const { lang } = opts;
  const title = lang === "th" ? "เอกสารทางการแพทย์ (สำหรับแพทย์)" : "Medical records (clinician view)";
  const rows = opts.records.map((r) => `<div class="row">
    <div class="label">${esc(r.kind)}</div>
    <div class="value">${esc(r.facility ?? "—")}</div>
    <div class="label">${esc(r.issuedAt ?? "")}${r.validUntil ? ` → ${esc(r.validUntil)}` : ""}</div>
  </div>`).join("");
  const body = `<div class="card"><div class="head"><h1>${esc(title)}</h1></div>
    ${rows || `<div class="row"><div class="value">—</div></div>`}
    <div class="foot">${lang === "th" ? DISCLAIMER_TH : DISCLAIMER_EN}</div></div>`;
  return shell(title, lang, body, lang === "th" ? "en" : "th");
}

export function renderPasscodeForm(opts: { token: string; lang: "th" | "en"; error?: boolean }): string {
  const { lang } = opts;
  const title = lang === "th" ? "กรอกรหัสผ่าน" : "Enter passcode";
  const body = `<div class="card"><div class="head"><h1>${esc(title)}</h1></div>
    <form method="post" action="/s/${esc(opts.token)}?lang=${lang}" class="row">
      ${opts.error ? `<div class="value" style="color:#B3261E">${lang === "th" ? "รหัสไม่ถูกต้อง" : "Wrong passcode"}</div>` : ""}
      <input name="passcode" inputmode="numeric" pattern="[0-9]*" maxlength="4" required
        style="font-size:24px;padding:10px;width:120px;letter-spacing:8px;text-align:center" />
      <button type="submit" style="font-size:18px;padding:10px 18px;margin-left:8px">OK</button>
    </form></div>`;
  return shell(title, lang, body, lang === "th" ? "en" : "th");
}
