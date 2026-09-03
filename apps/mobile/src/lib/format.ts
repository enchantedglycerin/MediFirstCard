import dayjs from "dayjs";

/** ISO date/time -> short local date, Buddhist-era year when the UI is Thai. */
export function formatDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return "—";
  const d = dayjs(iso);
  if (!d.isValid()) return iso;
  if (lang === "th") return `${d.format("D/M/")}${d.year() + 543}`;
  return d.format("D MMM YYYY");
}

export function formatDateTime(iso: string | null | undefined, lang: string): string {
  if (!iso) return "—";
  const d = dayjs(iso);
  if (!d.isValid()) return iso;
  return `${formatDate(iso, lang)} ${d.format("HH:mm")}`;
}

/** Days until an ISO date (negative when past). */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = dayjs(iso);
  if (!d.isValid()) return null;
  return d.startOf("day").diff(dayjs().startOf("day"), "day");
}

export function isValidIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).isValid();
}

/** Thai phone: 0 followed by 8–9 digits, spaces and hyphens ignored. */
export function isValidThaiPhone(v: string): boolean {
  return /^0\d{8,9}$/.test(v.replace(/[\s-]/g, ""));
}

export function normalizeThaiPhone(v: string): string {
  return v.replace(/[\s-]/g, "");
}
