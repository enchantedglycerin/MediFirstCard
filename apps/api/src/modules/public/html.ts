import { EMERGENCY_NUMBER, dialable, i18nMessages, type CardLine } from "@mfc/shared";

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
.doc{margin-top:14px}
.doc .head{background:#005B96}
.doc .head h1{font-size:18px}
.doc .head .sub{margin-top:2px;font-size:14px;opacity:.9}
.kv{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;padding:12px 18px;border-bottom:1px solid #eef1f4}
.kv .label{grid-column:1/-1}
.kv .value{font-size:17px}
.img{display:block;width:100%;height:auto;background:#eef1f4}
.imgwrap{padding:12px 18px 4px}
.imgwrap a{display:block;margin:8px 0 6px;font-size:14px;color:#005B96;text-decoration:none}
.meta{padding:10px 18px 14px;font-size:13px;color:#5b6370}
@media(prefers-color-scheme:dark){.kv{border-color:#2a333d}.img{background:#1c242c}}
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

export interface ClinicianRecord {
  kind: string;
  title: string | null;
  facility: string | null;
  doctorName: string | null;
  doctorLicenseNo: string | null;
  issuedAt: string | null;
  validUntil: string | null;
  notes: string | null;
  status: string;
  /** Signed, short-lived URL of the document image; null when no image was uploaded. */
  imageUrl: string | null;
  createdAt: string;
}

function kindLabel(kind: string, lang: "th" | "en"): string {
  const kinds = (i18nMessages[lang] as { records: { kinds: Record<string, string> } }).records.kinds;
  return kinds[kind] ?? kind;
}

function fmtDate(iso: string | null, lang: "th" | "en"): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH-u-ca-buddhist" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

/** One card per shared document: type, title, facility, doctor, dates, notes and the scanned image. */
export function renderClinicianPage(opts: {
  ownerName: string | null;
  records: ClinicianRecord[];
  expiresAt: string | null;
  lang: "th" | "en";
}): string {
  const { lang } = opts;
  const t = lang === "th"
    ? { title: "เอกสารทางการแพทย์ (สำหรับแพทย์)", of: "ของ", facility: "สถานพยาบาล", doctor: "แพทย์", licence: "เลขใบอนุญาต", issued: "วันที่ออก", valid: "ใช้ได้ถึง", notes: "หมายเหตุ", open: "เปิดภาพขนาดเต็ม", noImage: "ไม่มีภาพเอกสาร", added: "เพิ่มเมื่อ", reviewed: "ตรวจทานแล้ว", pending: "ยังไม่ตรวจทาน", expires: "ลิงก์นี้หมดอายุ", none: "ไม่มีเอกสารในลิงก์นี้" }
    : { title: "Medical records (clinician view)", of: "for", facility: "Facility", doctor: "Doctor", licence: "Licence no.", issued: "Issued", valid: "Valid until", notes: "Notes", open: "Open full-size image", noImage: "No image for this document", added: "Added", reviewed: "Reviewed by the owner", pending: "Not yet reviewed by the owner", expires: "This link expires", none: "No documents in this link" };
  const cards = opts.records.map((r) => `<div class="card doc">
    <div class="head"><h1>${esc(kindLabel(r.kind, lang))}</h1>${r.title ? `<div class="sub">${esc(r.title)}</div>` : ""}</div>
    <div class="kv">
      <div><div class="label">${t.facility}</div><div class="value">${esc(r.facility ?? "—")}</div></div>
      <div><div class="label">${t.doctor}</div><div class="value">${esc(r.doctorName ?? "—")}${r.doctorLicenseNo ? ` <span style="font-size:13px;color:#5b6370">(${t.licence} ${esc(r.doctorLicenseNo)})</span>` : ""}</div></div>
      <div><div class="label">${t.issued}</div><div class="value">${esc(fmtDate(r.issuedAt, lang))}</div></div>
      <div><div class="label">${t.valid}</div><div class="value">${esc(fmtDate(r.validUntil, lang))}</div></div>
      ${r.notes ? `<div style="grid-column:1/-1"><div class="label">${t.notes}</div><div class="value" style="font-size:16px;white-space:pre-wrap">${esc(r.notes)}</div></div>` : ""}
    </div>
    ${r.imageUrl
      ? `<div class="imgwrap"><a href="${esc(r.imageUrl)}" target="_blank" rel="noopener"><img class="img" src="${esc(r.imageUrl)}" alt="${esc(kindLabel(r.kind, lang))}" loading="lazy"></a><a href="${esc(r.imageUrl)}" target="_blank" rel="noopener">${t.open} ↗</a></div>`
      : `<div class="meta">${t.noImage}</div>`}
    <div class="meta">${r.status === "reviewed" ? t.reviewed : t.pending} · ${t.added} ${esc(fmtDate(r.createdAt, lang))}</div>
  </div>`).join("");
  const heading = opts.ownerName ? `${t.title} ${t.of} ${esc(opts.ownerName)}` : t.title;
  const body = `<div class="card"><div class="head"><h1>${heading}</h1>${opts.expiresAt ? `<div class="sub">${t.expires} ${esc(fmtDate(opts.expiresAt, lang))}</div>` : ""}</div>
    <div class="foot">${lang === "th" ? DISCLAIMER_TH : DISCLAIMER_EN}</div></div>
    ${cards || `<div class="card doc"><div class="row"><div class="value">${t.none}</div></div></div>`}`;
  return shell(t.title, lang, body, lang === "th" ? "en" : "th");
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
