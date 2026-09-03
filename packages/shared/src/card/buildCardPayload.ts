// Pure, dependency-free card-payload builder. The ONE source of truth for the
// ordered lines every lock-screen surface renders: the notification card, the
// wallpaper image, the Android widget task handler, the public rescuer page and
// the PDF card. Keep it free of imports so the widget bundle stays tiny.

export interface LockScreenFields {
  name: boolean;
  bloodType: boolean;
  allergies: boolean;
  conditions: boolean;
  medications: boolean;
  contact: boolean;
}

export const DEFAULT_LOCK_SCREEN_FIELDS: LockScreenFields = {
  name: true,
  bloodType: true,
  allergies: true,
  conditions: false,
  medications: false,
  contact: true,
};

export interface CardProfile {
  nameTh?: string | null;
  nameEn?: string | null;
  bloodAbo?: "A" | "B" | "AB" | "O" | "unknown" | null;
  bloodRh?: "pos" | "neg" | "unknown" | null;
  noKnownDrugAllergy?: boolean;
  allergies?: Array<{ substance: string; severity?: "mild" | "moderate" | "severe" | null }>;
  conditions?: Array<{ label: string; critical?: boolean }>;
  medications?: Array<{ name: string; critical?: boolean }>;
  contacts?: Array<{ name: string; relationship?: string | null; phone: string }>;
  lastReviewedAt?: string | null;
}

export type CardLineKind = "identity" | "blood" | "allergy" | "condition" | "medication" | "contact";

export interface CardLine {
  kind: CardLineKind;
  label: string;
  value: string;
  /** true for allergies and other must-not-miss lines; renderers show these in red first. */
  urgent: boolean;
  /** Dialable number for contact lines (digits only), so every surface can offer tap-to-call. */
  phone?: string;
}

/** Thai national emergency medical service number (สถาบันการแพทย์ฉุกเฉินแห่งชาติ). */
export const EMERGENCY_NUMBER = "1669";

/** Keep only characters a dialer accepts. */
export function dialable(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}

export interface CardPayload {
  lines: CardLine[];
  /** ISO date the profile was last reviewed, for the "self-reported, last updated" footer. */
  lastReviewedAt: string | null;
}

function bloodText(abo?: CardProfile["bloodAbo"], rh?: CardProfile["bloodRh"]): string | null {
  if (!abo || abo === "unknown") return null;
  const rhText = rh === "pos" ? "+" : rh === "neg" ? "−" : "";
  return `${abo}${rhText}`;
}

/**
 * Build the ordered card lines from a profile and the user's field selection.
 * Order follows the "first 60 seconds" priority: identity, blood, allergies,
 * conditions, medications, contacts. Only fields the user enabled are included.
 */
export function buildCardPayload(profile: CardProfile, fields: LockScreenFields): CardPayload {
  const lines: CardLine[] = [];

  if (fields.name) {
    const name = profile.nameTh || profile.nameEn;
    if (name) lines.push({ kind: "identity", label: "Name", value: name, urgent: false });
  }

  if (fields.bloodType) {
    const blood = bloodText(profile.bloodAbo, profile.bloodRh);
    if (blood) {
      lines.push({
        kind: "blood",
        label: "Blood",
        value: blood,
        urgent: profile.bloodRh === "neg", // Rh-negative is rare in Thailand; flag it
      });
    }
  }

  if (fields.allergies) {
    if (profile.noKnownDrugAllergy) {
      lines.push({ kind: "allergy", label: "Allergies", value: "No known drug allergies", urgent: false });
    } else {
      const allergies = (profile.allergies ?? []).filter((a) => a.substance.trim().length > 0);
      for (const a of allergies) {
        const sev = a.severity && a.severity !== "mild" ? ` (${a.severity})` : "";
        lines.push({ kind: "allergy", label: "Allergy", value: `${a.substance}${sev}`, urgent: true });
      }
    }
  }

  if (fields.conditions) {
    for (const c of profile.conditions ?? []) {
      if (c.label.trim().length === 0) continue;
      lines.push({ kind: "condition", label: "Condition", value: c.label, urgent: Boolean(c.critical) });
    }
  }

  if (fields.medications) {
    for (const m of profile.medications ?? []) {
      if (m.name.trim().length === 0) continue;
      lines.push({ kind: "medication", label: "Medication", value: m.name, urgent: Boolean(m.critical) });
    }
  }

  if (fields.contact) {
    const contacts = [...(profile.contacts ?? [])].filter((c) => c.phone.trim().length > 0);
    for (const c of contacts) {
      const rel = c.relationship ? ` (${c.relationship})` : "";
      lines.push({ kind: "contact", label: "ICE", value: `${c.name}${rel} ${c.phone}`.trim(), urgent: false, phone: dialable(c.phone) });
    }
  }

  return { lines, lastReviewedAt: profile.lastReviewedAt ?? null };
}

/** One-line body for the sticky notification: blood group + top allergy. */
export function notificationTitle(payload: CardPayload): string {
  const blood = payload.lines.find((l) => l.kind === "blood");
  const allergy = payload.lines.find((l) => l.kind === "allergy" && l.urgent);
  const parts = [blood?.value, allergy?.value].filter(Boolean);
  return parts.length ? parts.join(" · ") : "MediFirstCard – Emergency";
}
