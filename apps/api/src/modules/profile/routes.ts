import { Router } from "express";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import {
  emergencyProfileInput, allergyInput, conditionInput, medicationInput, contactInput,
  lockScreenFieldsSchema, noKnownDrugAllergyInput, DEFAULT_LOCK_SCREEN_FIELDS, type LockScreenFields,
} from "@mfc/shared";
import type { AppContext } from "../../context.js";
import { env } from "../../config/env.js";
import { requireAuth } from "../../auth/middleware.js";
import { encryptOptional, decryptOptional } from "../../crypto/fieldEncryption.js";
import { users, emergencyProfiles, allergies, conditions, medications, emergencyContacts } from "../../db/schema.js";
import { buildCardForUser, getOrCreateEmergencyLink } from "./service.js";

const uid = (req: { userId?: string }) => req.userId as string;

async function hasAllergies(ctx: AppContext, userId: string): Promise<boolean> {
  const [row] = await ctx.db.select({ id: allergies.id }).from(allergies).where(eq(allergies.userId, userId)).limit(1);
  return row !== undefined;
}

/** "No known drug allergies" and a listed allergy contradict each other; the list wins. */
async function clearNoKnownDrugAllergy(ctx: AppContext, userId: string): Promise<void> {
  await ctx.db.update(emergencyProfiles).set({ noKnownDrugAllergy: false, updatedAt: new Date() })
    .where(eq(emergencyProfiles.userId, userId));
}

function profileDto(row: typeof emergencyProfiles.$inferSelect) {
  return {
    firstNameTh: decryptOptional(row.firstNameThEnc),
    lastNameTh: decryptOptional(row.lastNameThEnc),
    nameEn: decryptOptional(row.nameEnEnc),
    dob: row.dob,
    sex: row.sex,
    bloodAbo: row.bloodAbo,
    bloodRh: row.bloodRh,
    noKnownDrugAllergy: row.noKnownDrugAllergy,
    flags: row.flags,
    insuranceScheme: row.insuranceScheme,
    preferredLanguage: row.preferredLanguage,
    notes: decryptOptional(row.notesEnc),
    lockScreenFields: row.lockScreenFields as LockScreenFields,
    lastReviewedAt: row.lastReviewedAt,
  };
}

// Small generic CRUD for the four profile sub-collections.
interface CrudCfg {
  path: string;
  table: typeof allergies | typeof conditions | typeof medications | typeof emergencyContacts;
  parse: (body: unknown) => Record<string, unknown>;
  toRow: (input: Record<string, unknown>) => Record<string, unknown>;
  toDto: (row: Record<string, unknown>) => Record<string, unknown>;
  /** Runs after a successful insert (e.g. an allergy clears the "none known" flag). */
  afterInsert?: (userId: string) => Promise<void>;
}

function crud(ctx: AppContext, cfg: CrudCfg): Router {
  const r = Router();
  const table = cfg.table as typeof allergies;
  r.get(cfg.path, async (req, res, next) => {
    try {
      const rows = await ctx.db.select().from(table).where(eq(table.userId, uid(req)));
      res.json(rows.map((row) => cfg.toDto(row as Record<string, unknown>)));
    } catch (e) { next(e); }
  });
  r.post(cfg.path, async (req, res, next) => {
    try {
      const input = cfg.parse(req.body);
      const [row] = await ctx.db.insert(table).values({ userId: uid(req), ...cfg.toRow(input) } as never).returning();
      await cfg.afterInsert?.(uid(req));
      res.status(201).json(cfg.toDto(row as Record<string, unknown>));
    } catch (e) { next(e); }
  });
  r.put(`${cfg.path}/:id`, async (req, res, next) => {
    try {
      const input = cfg.parse(req.body);
      const [row] = await ctx.db
        .update(table).set(cfg.toRow(input) as never)
        .where(and(eq(table.id, req.params.id as string), eq(table.userId, uid(req)))).returning();
      if (!row) { res.status(404).json({ code: "NOT_FOUND", message: "Not found" }); return; }
      res.json(cfg.toDto(row as Record<string, unknown>));
    } catch (e) { next(e); }
  });
  r.delete(`${cfg.path}/:id`, async (req, res, next) => {
    try {
      await ctx.db.delete(table).where(and(eq(table.id, req.params.id as string), eq(table.userId, uid(req))));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
  return r;
}

export function profileRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth());

  r.get("/me", async (req, res, next) => {
    try {
      const [u] = await ctx.db.select({ id: users.id, email: users.email, locale: users.locale }).from(users).where(eq(users.id, uid(req)));
      if (!u) { res.status(404).json({ code: "NOT_FOUND", message: "User not found" }); return; }
      res.json(u);
    } catch (e) { next(e); }
  });

  r.get("/me/profile", async (req, res, next) => {
    try {
      const [p] = await ctx.db.select().from(emergencyProfiles).where(eq(emergencyProfiles.userId, uid(req)));
      res.json(p ? profileDto(p) : { lockScreenFields: DEFAULT_LOCK_SCREEN_FIELDS, exists: false });
    } catch (e) { next(e); }
  });

  r.put("/me/profile", async (req, res, next) => {
    try {
      const input = emergencyProfileInput.parse(req.body);
      if (input.noKnownDrugAllergy && (await hasAllergies(ctx, uid(req)))) {
        res.status(400).json({ code: "ALLERGIES_EXIST", message: "Delete the listed allergies before marking none known" });
        return;
      }
      const enc = {
        firstNameThEnc: encryptOptional(input.firstNameTh),
        lastNameThEnc: encryptOptional(input.lastNameTh),
        nameEnEnc: encryptOptional(input.nameEn),
        notesEnc: encryptOptional(input.notes),
      };
      const common = {
        dob: input.dob ?? null,
        sex: input.sex,
        bloodAbo: input.bloodAbo,
        bloodRh: input.bloodRh,
        // Optional: a save that omits the flag leaves the user's earlier choice untouched.
        ...(input.noKnownDrugAllergy === undefined ? {} : { noKnownDrugAllergy: input.noKnownDrugAllergy }),
        flags: input.flags,
        insuranceScheme: input.insuranceScheme,
        preferredLanguage: input.preferredLanguage,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
      };
      const [row] = await ctx.db
        .insert(emergencyProfiles)
        .values({ userId: uid(req), ...enc, ...common, lockScreenFields: DEFAULT_LOCK_SCREEN_FIELDS })
        .onConflictDoUpdate({ target: emergencyProfiles.userId, set: { ...enc, ...common } })
        .returning();
      res.json(profileDto(row!));
    } catch (e) { next(e); }
  });

  r.put("/me/no-known-drug-allergy", async (req, res, next) => {
    try {
      const { value } = noKnownDrugAllergyInput.parse(req.body);
      if (value && (await hasAllergies(ctx, uid(req)))) {
        res.status(400).json({ code: "ALLERGIES_EXIST", message: "Delete the listed allergies before marking none known" });
        return;
      }
      const [row] = await ctx.db
        .update(emergencyProfiles).set({ noKnownDrugAllergy: value, lastReviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(emergencyProfiles.userId, uid(req))).returning();
      if (!row) { res.status(404).json({ code: "NO_PROFILE", message: "Create a profile first" }); return; }
      res.json({ noKnownDrugAllergy: row.noKnownDrugAllergy });
    } catch (e) { next(e); }
  });

  r.put("/me/lock-screen-fields", async (req, res, next) => {
    try {
      const fields = lockScreenFieldsSchema.parse(req.body);
      const [row] = await ctx.db
        .update(emergencyProfiles).set({ lockScreenFields: fields, updatedAt: new Date() })
        .where(eq(emergencyProfiles.userId, uid(req))).returning();
      if (!row) { res.status(404).json({ code: "NO_PROFILE", message: "Create a profile first" }); return; }
      res.json({ lockScreenFields: row.lockScreenFields });
    } catch (e) { next(e); }
  });

  r.get("/me/emergency-card", async (req, res, next) => {
    try {
      const payload = await buildCardForUser(ctx, uid(req));
      const link = await getOrCreateEmergencyLink(ctx, uid(req));
      const emergencyUrl = `${env.PUBLIC_BASE_URL}/e/${link.token}`;
      const qrPngDataUrl = await QRCode.toDataURL(emergencyUrl, { margin: 1, width: 320 });
      res.json({ lines: payload.lines, lastReviewedAt: payload.lastReviewedAt, emergencyUrl, qrPngDataUrl, shareLinkId: link.id });
    } catch (e) { next(e); }
  });

  r.use(crud(ctx, {
    path: "/me/allergies", table: allergies,
    parse: (b) => allergyInput.parse(b),
    afterInsert: (userId) => clearNoKnownDrugAllergy(ctx, userId),
    toRow: (i) => ({
      substanceEnEnc: encryptOptional(i.substanceEn as string | undefined),
      substanceThEnc: encryptOptional(i.substanceTh as string | undefined),
      category: i.category, reactionEnc: encryptOptional(i.reaction as string | undefined),
      severity: i.severity, source: i.source, updatedAt: new Date(),
    }),
    toDto: (row) => ({
      id: row.id, substanceEn: decryptOptional(row.substanceEnEnc as string | null),
      substanceTh: decryptOptional(row.substanceThEnc as string | null),
      category: row.category, reaction: decryptOptional(row.reactionEnc as string | null),
      severity: row.severity, source: row.source,
    }),
  }));

  r.use(crud(ctx, {
    path: "/me/conditions", table: conditions,
    parse: (b) => conditionInput.parse(b),
    toRow: (i) => ({
      code: i.code ?? null, labelThEnc: encryptOptional(i.labelTh as string | undefined),
      labelEnEnc: encryptOptional(i.labelEn as string | undefined),
      status: i.status, onsetYear: i.onsetYear ?? null, critical: i.critical, updatedAt: new Date(),
    }),
    toDto: (row) => ({
      id: row.id, code: row.code, labelTh: decryptOptional(row.labelThEnc as string | null),
      labelEn: decryptOptional(row.labelEnEnc as string | null),
      status: row.status, onsetYear: row.onsetYear, critical: row.critical,
    }),
  }));

  r.use(crud(ctx, {
    path: "/me/medications", table: medications,
    parse: (b) => medicationInput.parse(b),
    toRow: (i) => ({
      nameEnc: encryptOptional(i.name as string)!, strengthEnc: encryptOptional(i.strength as string | undefined),
      doseEnc: encryptOptional(i.dose as string | undefined), frequencyThEnc: encryptOptional(i.frequencyTh as string | undefined),
      critical: i.critical, updatedAt: new Date(),
    }),
    toDto: (row) => ({
      id: row.id, name: decryptOptional(row.nameEnc as string | null), strength: decryptOptional(row.strengthEnc as string | null),
      dose: decryptOptional(row.doseEnc as string | null), frequencyTh: decryptOptional(row.frequencyThEnc as string | null),
      critical: row.critical,
    }),
  }));

  r.use(crud(ctx, {
    path: "/me/contacts", table: emergencyContacts,
    parse: (b) => contactInput.parse(b),
    toRow: (i) => ({
      nameEnc: encryptOptional(i.name as string)!, relationship: i.relationship ?? null,
      phoneEnc: encryptOptional(i.phone as string)!, informedConsent: i.informedConsent, priority: i.priority, updatedAt: new Date(),
    }),
    toDto: (row) => ({
      id: row.id, name: decryptOptional(row.nameEnc as string | null), relationship: row.relationship,
      phone: decryptOptional(row.phoneEnc as string | null), informedConsent: row.informedConsent, priority: row.priority,
    }),
  }));

  return r;
}
