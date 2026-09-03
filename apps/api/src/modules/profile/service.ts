import { and, eq, asc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { type CardProfile, type LockScreenFields, DEFAULT_LOCK_SCREEN_FIELDS, buildCardPayload } from "@mfc/shared";
import type { AppContext } from "../../context.js";
import { hashToken } from "../../auth/tokens.js";
import { decryptOptional } from "../../crypto/fieldEncryption.js";
import { emergencyProfiles, allergies, conditions, medications, emergencyContacts, shareLinks } from "../../db/schema.js";

export async function loadCardProfile(ctx: AppContext, userId: string): Promise<CardProfile | null> {
  const [p] = await ctx.db.select().from(emergencyProfiles).where(eq(emergencyProfiles.userId, userId));
  if (!p) return null;
  const [al, co, me, ct] = await Promise.all([
    ctx.db.select().from(allergies).where(eq(allergies.userId, userId)),
    ctx.db.select().from(conditions).where(eq(conditions.userId, userId)),
    ctx.db.select().from(medications).where(eq(medications.userId, userId)),
    ctx.db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, userId)).orderBy(asc(emergencyContacts.priority)),
  ]);
  return {
    nameTh: [decryptOptional(p.firstNameThEnc), decryptOptional(p.lastNameThEnc)].filter(Boolean).join(" ") || null,
    nameEn: decryptOptional(p.nameEnEnc),
    bloodAbo: p.bloodAbo,
    bloodRh: p.bloodRh,
    noKnownDrugAllergy: p.noKnownDrugAllergy,
    allergies: al.map((a) => ({ substance: decryptOptional(a.substanceThEnc) || decryptOptional(a.substanceEnEnc) || "", severity: a.severity })),
    conditions: co.map((c) => ({ label: decryptOptional(c.labelThEnc) || decryptOptional(c.labelEnEnc) || "", critical: c.critical })),
    medications: me.map((m) => ({ name: decryptOptional(m.nameEnc) || "", critical: m.critical })),
    contacts: ct.map((c) => ({ name: decryptOptional(c.nameEnc) || "", relationship: c.relationship, phone: decryptOptional(c.phoneEnc) || "" })),
    lastReviewedAt: p.lastReviewedAt ? p.lastReviewedAt.toISOString().slice(0, 10) : null,
  };
}

export async function getLockScreenFields(ctx: AppContext, userId: string): Promise<LockScreenFields> {
  const [p] = await ctx.db.select({ f: emergencyProfiles.lockScreenFields }).from(emergencyProfiles).where(eq(emergencyProfiles.userId, userId));
  return (p?.f as LockScreenFields) ?? DEFAULT_LOCK_SCREEN_FIELDS;
}

/** Build the ordered card lines for a user, filtered by their current lock-screen selection. */
export async function buildCardForUser(ctx: AppContext, userId: string) {
  const profile = await loadCardProfile(ctx, userId);
  const fields = await getLockScreenFields(ctx, userId);
  return profile ? buildCardPayload(profile, fields) : { lines: [], lastReviewedAt: null };
}

export async function getOrCreateEmergencyLink(ctx: AppContext, userId: string): Promise<{ token: string; id: string }> {
  const [existing] = await ctx.db.select().from(shareLinks).where(and(eq(shareLinks.userId, userId), eq(shareLinks.scope, "emergency")));
  if (existing && !existing.revokedAt && existing.token) return { token: existing.token, id: existing.id };
  const token = randomBytes(24).toString("base64url");
  const [row] = await ctx.db.insert(shareLinks).values({ userId, scope: "emergency", token, tokenHash: hashToken(token) }).returning({ id: shareLinks.id });
  return { token, id: row!.id };
}
