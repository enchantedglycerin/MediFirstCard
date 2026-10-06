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

export const FLAG_KEYS = ["anticoagulant", "insulin", "pacemaker", "dialysis", "pregnancy"] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

/** Canonical values of the "warning" lines made from the Medical flags; renderers translate them via profile.flagOptions.<key>. */
export const FLAG_LINE_VALUES: Record<FlagKey, string> = {
  anticoagulant: "On blood thinners",
  insulin: "Insulin-dependent",
  pacemaker: "Pacemaker",
  dialysis: "On dialysis",
  pregnancy: "Pregnant",
};

/** The flag behind a warning line, or null when the value is not one of the flags. */
export function flagKeyOfValue(value: string): FlagKey | null {
  return FLAG_KEYS.find((k) => FLAG_LINE_VALUES[k] === value) ?? null;
}

export interface CardProfile {
  nameTh?: string | null;
  nameEn?: string | null;
  /** Medical flags that are switched on; each becomes a "warning" line ahead of the conditions. */
  flags?: FlagKey[];
  bloodAbo?: "A" | "B" | "AB" | "O" | "unknown" | null;
  bloodRh?: "pos" | "neg" | "unknown" | null;
  noKnownDrugAllergy?: boolean;
  allergies?: Array<{ substance: string; severity?: "mild" | "moderate" | "severe" | null }>;
  conditions?: Array<{ label: string; critical?: boolean }>;
  medications?: Array<{ name: string; critical?: boolean }>;
  contacts?: Array<{ name: string; relationship?: string | null; phone: string }>;
  lastReviewedAt?: string | null;
}

export type CardLineKind = "identity" | "blood" | "allergy" | "warning" | "condition" | "medication" | "contact";

export interface CardLine {
  kind: CardLineKind;
  label: string;
  value: string;
  /** true for allergies and other must-not-miss lines; renderers show these in red first. */
  urgent: boolean;
  /** Dialable number for contact lines (digits only), so every surface can offer tap-to-call. */
  phone?: string;
}

/** Sentinel value of the allergy line when the user marked "none known"; renderers translate it. */
export const NO_KNOWN_DRUG_ALLERGY = "No known drug allergies";

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
 * warnings (medical flags), conditions, medications, contacts. Only fields the user enabled are included.
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
    // Listed allergies always win: a stale "none known" flag must never hide a real allergy.
    const allergies = (profile.allergies ?? []).filter((a) => a.substance.trim().length > 0);
    if (allergies.length > 0) {
      for (const a of allergies) {
        const sev = a.severity && a.severity !== "mild" ? ` (${a.severity})` : "";
        lines.push({ kind: "allergy", label: "Allergy", value: `${a.substance}${sev}`, urgent: true });
      }
    } else if (profile.noKnownDrugAllergy) {
      lines.push({ kind: "allergy", label: "Allergies", value: NO_KNOWN_DRUG_ALLERGY, urgent: false });
    }
  }

  // Critical items come first within their group, so what a rescuer must not miss is read first.
  const criticalFirst = <T extends { critical?: boolean }>(items: T[]): T[] =>
    [...items.filter((i) => i.critical), ...items.filter((i) => !i.critical)];

  if (fields.conditions) {
    // The flags ride on the Conditions toggle, so hiding conditions for privacy hides them too.
    for (const k of profile.flags ?? []) {
      lines.push({ kind: "warning", label: "Warning", value: FLAG_LINE_VALUES[k], urgent: true });
    }
    for (const c of criticalFirst((profile.conditions ?? []).filter((c) => c.label.trim().length > 0))) {
      lines.push({ kind: "condition", label: "Condition", value: c.label, urgent: Boolean(c.critical) });
    }
  }

  if (fields.medications) {
    for (const m of criticalFirst((profile.medications ?? []).filter((m) => m.name.trim().length > 0))) {
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

