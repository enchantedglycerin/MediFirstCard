// Buddhist-era date helpers. Dependency-free on purpose so the Android widget
// task handler can import the card builder without pulling dayjs.
// Store every date as ISO 8601 (CE, YYYY-MM-DD); display in Buddhist era.

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A year > 2400 is assumed Buddhist-era; convert to CE by subtracting 543. */
export function beYearToCE(year: number): number {
  return year > 2400 ? year - 543 : year;
}

/** A year < 2400 is assumed CE; convert to Buddhist era by adding 543. */
export function ceYearToBE(year: number): number {
  return year < 2400 ? year + 543 : year;
}

/** Parse an ISO date (YYYY-MM-DD) into parts, or null if malformed. */
function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/**
 * Format a stored CE ISO date for display.
 * "th" -> "3 กันยายน 2569 (2026)"; "en" -> "3 September 2026".
 * Returns the raw input unchanged if it is not a valid ISO date.
 */
export function formatBE(iso: string, locale: "th" | "en" = "th"): string {
  const parts = parseIso(iso);
  if (!parts) return iso;
  const { y, m, d } = parts;
  if (locale === "en") {
    return `${d} ${EN_MONTHS[m - 1]} ${y}`;
  }
  return `${d} ${TH_MONTHS[m - 1]} ${ceYearToBE(y)} (${y})`;
}

/** True if the ISO date is in the future relative to `today` (validation helper). */
export function isFutureDate(iso: string, today: string): boolean {
  const a = parseIso(iso);
  const b = parseIso(today);
  if (!a || !b) return false;
  return iso.slice(0, 10) > today.slice(0, 10);
}
