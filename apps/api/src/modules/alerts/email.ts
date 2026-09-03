import type { NotificationKind } from "@mfc/shared";
import { ProviderError, withRetry, isRetryableStatus, type FetchLike } from "../extract/providers/common.js";

// Alert e-mail through Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
// Raw fetch, injectable for tests, retried on 429/5xx. A 403 from the free tier means
// "you can only send testing emails to your own address" until a domain is verified.

export const RESEND_URL = "https://api.resend.com/emails";

export interface EmailSettings {
  apiKey: string;
  from: string;
  fetchImpl?: FetchLike;
  retryBaseMs?: number;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(msg: EmailMessage, s: EmailSettings): Promise<{ id: string | null }> {
  const fetchImpl = s.fetchImpl ?? globalThis.fetch;
  return withRetry(
    async () => {
      let res: Response;
      try {
        res = await fetchImpl(RESEND_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${s.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: s.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
        });
      } catch (e) {
        throw new ProviderError("resend", e instanceof Error ? e.message : "network error", undefined, true);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const hint = res.status === 403 ? " (free tier: verify a domain on Resend, or set ALERT_EMAIL_TO to the account owner's address)" : "";
        throw new ProviderError("resend", `HTTP ${res.status}: ${body.slice(0, 160)}${hint}`, res.status, isRetryableStatus(res.status));
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return { id: json.id ?? null };
    },
    { retries: 2, baseMs: s.retryBaseMs ?? 1000 },
  );
}

const SUBJECT: Record<NotificationKind, { th: string; en: string }> = {
  card_viewed: { th: "มีคนดูบัตรฉุกเฉินของคุณ", en: "Your emergency card was viewed" },
  share_viewed: { th: "มีคนเปิดลิงก์เอกสารที่คุณแชร์", en: "A shared document link was opened" },
  share_revoked: { th: "ลิงก์ที่แชร์ถูกยกเลิกเพราะกรอกรหัสผิดหลายครั้ง", en: "A shared link was revoked after too many wrong passcodes" },
  expiry: { th: "เอกสารของคุณใกล้หมดอายุ", en: "A document of yours is expiring soon" },
  follow_up: { th: "ถึงกำหนดนัดติดตามอาการ", en: "Follow-up appointment reminder" },
};

const BODY: Record<NotificationKind, { th: string; en: string }> = {
  card_viewed: {
    th: "มีคนเปิดหน้าบัตรฉุกเฉินของคุณ (สแกน QR หรือเปิดลิงก์) หากไม่ใช่เหตุฉุกเฉินของคุณ โปรดตรวจสอบว่าใครมีลิงก์นี้",
    en: "Someone opened your public emergency card (QR scan or link). If this was not an emergency of yours, check who has the link.",
  },
  share_viewed: {
    th: "มีคนเปิดลิงก์เอกสารที่คุณแชร์ให้แพทย์ คุณยกเลิกลิงก์ได้ทุกเมื่อในแอป",
    en: "Someone opened a document link you shared with a clinician. You can revoke it any time in the app.",
  },
  share_revoked: {
    th: "ลิงก์ที่แชร์ถูกยกเลิกอัตโนมัติหลังกรอกรหัสผิด 5 ครั้ง เอกสารของคุณยังปลอดภัย",
    en: "A shared link was revoked automatically after 5 wrong passcodes. Your documents remain safe.",
  },
  expiry: {
    th: "ใบรับรองแพทย์ของคุณจะหมดอายุเร็ว ๆ นี้ ตรวจสอบได้ในเมนูเอกสาร",
    en: "One of your medical certificates expires soon. Check it under Documents.",
  },
  follow_up: {
    th: "ถึงกำหนดนัดติดตามอาการตามเอกสารที่บันทึกไว้",
    en: "A follow-up date recorded on one of your documents is due.",
  },
};

const FOOTER_TH = "MediFirstCard เป็นต้นแบบเพื่อการศึกษา (รายวิชา 040333215) ไม่ใช่เครื่องมือแพทย์";
const FOOTER_EN = "MediFirstCard is an educational prototype (course 040333215), not a medical device.";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Bilingual subject/body for an alert kind, with the event time in Thai local time. */
export function alertEmailContent(kind: NotificationKind, at: Date): Pick<EmailMessage, "subject" | "text" | "html"> {
  const when = at.toLocaleString("en-GB", { timeZone: "Asia/Bangkok", hour12: false });
  const subject = `MediFirstCard: ${SUBJECT[kind].th} / ${SUBJECT[kind].en}`;
  const text = [
    SUBJECT[kind].th,
    BODY[kind].th,
    `เวลา ${when} (เวลาไทย)`,
    "",
    SUBJECT[kind].en,
    BODY[kind].en,
    `Time: ${when} (Bangkok)`,
    "",
    "เปิดแอป → การแจ้งเตือน / Open the app → Alerts",
    "",
    FOOTER_TH,
    FOOTER_EN,
  ].join("\n");
  const html = `<div style="font:16px/1.5 -apple-system,'Segoe UI',Tahoma,sans-serif;color:#1a1c1e;max-width:520px">
<h2 style="color:#005B96;margin:0 0 8px">${esc(SUBJECT[kind].th)}</h2><p>${esc(BODY[kind].th)}<br><small>เวลา ${esc(when)} (เวลาไทย)</small></p>
<h3 style="color:#005B96;margin:16px 0 8px">${esc(SUBJECT[kind].en)}</h3><p>${esc(BODY[kind].en)}<br><small>Time: ${esc(when)} (Bangkok)</small></p>
<p>เปิดแอป → การแจ้งเตือน / Open the app → Alerts</p>
<p style="color:#5b6370;font-size:13px">${esc(FOOTER_TH)}<br>${esc(FOOTER_EN)}</p></div>`;
  return { subject, text, html };
}
