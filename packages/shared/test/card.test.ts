import { describe, it, expect } from "vitest";
import {
  buildCardPayload,
  notificationTitle,
  dialable,
  EMERGENCY_NUMBER,
  DEFAULT_LOCK_SCREEN_FIELDS,
  type CardProfile,
} from "../src/card/buildCardPayload.js";

const profile: CardProfile = {
  nameTh: "สมชาย ใจดี",
  nameEn: "Somchai Jaidee",
  bloodAbo: "O",
  bloodRh: "neg",
  noKnownDrugAllergy: false,
  allergies: [{ substance: "Penicillin", severity: "severe" }],
  conditions: [{ label: "เบาหวาน", critical: true }],
  medications: [{ name: "Warfarin", critical: true }],
  contacts: [{ name: "แม่", relationship: "mother", phone: "0812345678" }],
  lastReviewedAt: "2026-09-01",
};

describe("buildCardPayload", () => {
  it("orders lines identity → blood → allergy → contact with defaults", () => {
    const { lines } = buildCardPayload(profile, DEFAULT_LOCK_SCREEN_FIELDS);
    expect(lines.map((l) => l.kind)).toEqual(["identity", "blood", "allergy", "contact"]);
  });

  it("hides fields the user disabled and shows the ones enabled", () => {
    const { lines } = buildCardPayload(profile, {
      ...DEFAULT_LOCK_SCREEN_FIELDS,
      name: false,
      conditions: true,
      medications: true,
    });
    const kinds = lines.map((l) => l.kind);
    expect(kinds).not.toContain("identity");
    expect(kinds).toContain("condition");
    expect(kinds).toContain("medication");
  });

  it("flags allergies as urgent and Rh-negative blood as urgent", () => {
    const { lines } = buildCardPayload(profile, DEFAULT_LOCK_SCREEN_FIELDS);
    expect(lines.find((l) => l.kind === "allergy")?.urgent).toBe(true);
    expect(lines.find((l) => l.kind === "blood")?.urgent).toBe(true);
    expect(lines.find((l) => l.kind === "allergy")?.value).toBe("Penicillin (severe)");
  });

  it("shows 'No known drug allergies' distinctly from an empty list", () => {
    const { lines } = buildCardPayload(
      { ...profile, noKnownDrugAllergy: true, allergies: [] },
      DEFAULT_LOCK_SCREEN_FIELDS,
    );
    const allergy = lines.find((l) => l.kind === "allergy");
    expect(allergy?.value).toBe("No known drug allergies");
    expect(allergy?.urgent).toBe(false);
  });

  it("builds a notification title from blood group and top allergy", () => {
    const payload = buildCardPayload(profile, DEFAULT_LOCK_SCREEN_FIELDS);
    expect(notificationTitle(payload)).toBe("O− · Penicillin (severe)");
  });

  it("gives contact lines a dialable phone so every surface can tap-to-call", () => {
    const { lines } = buildCardPayload(
      { ...profile, contacts: [{ name: "แม่", relationship: "mother", phone: "081-234 5678" }] },
      DEFAULT_LOCK_SCREEN_FIELDS,
    );
    const contact = lines.find((l) => l.kind === "contact");
    expect(contact?.phone).toBe("0812345678");
    expect(contact?.value).toContain("แม่");
    expect(lines.find((l) => l.kind === "identity")?.phone).toBeUndefined();
  });

  it("exposes the Thai EMS number and strips formatting when dialing", () => {
    expect(EMERGENCY_NUMBER).toBe("1669");
    expect(dialable("+66 (0) 81-234-5678")).toBe("+660812345678");
  });
});
