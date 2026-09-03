import {
  pgTable, pgEnum, uuid, text, boolean, integer, timestamp, jsonb, date, uniqueIndex, index,
} from "drizzle-orm/pg-core";

// --- enums ---
export const bloodAbo = pgEnum("blood_abo", ["A", "B", "AB", "O", "unknown"]);
export const bloodRh = pgEnum("blood_rh", ["pos", "neg", "unknown"]);
export const sex = pgEnum("sex", ["male", "female", "other", "unspecified"]);
export const insuranceScheme = pgEnum("insurance_scheme", ["ucs", "sss", "csmbs", "private", "self_pay", "unknown"]);
export const allergyCategory = pgEnum("allergy_category", ["medication", "food", "environment"]);
export const allergySeverity = pgEnum("allergy_severity", ["mild", "moderate", "severe"]);
export const allergySource = pgEnum("allergy_source", ["self", "hospital_card"]);
export const conditionStatus = pgEnum("condition_status", ["active", "resolved"]);
export const medStatus = pgEnum("med_status", ["active", "stopped"]);
export const recordKind = pgEnum("record_kind", [
  "certificate_general", "certificate_driving", "certificate_5disease", "sick_leave",
  "prescription", "lab", "vaccine", "allergy_card", "discharge", "receipt", "other",
]);
export const recordStatus = pgEnum("record_status", ["pending", "uploaded", "extracted", "reviewed"]);
export const extractionSource = pgEnum("extraction_source", ["live", "mock"]);
export const imageQuality = pgEnum("image_quality", ["good", "fair", "poor"]);
export const shareScope = pgEnum("share_scope", ["emergency", "records"]);
export const shareOutcome = pgEnum("share_outcome", ["ok", "expired", "revoked", "not_found", "bad_passcode"]);
export const notificationKind = pgEnum("notification_kind", [
  "card_viewed", "share_viewed", "share_revoked", "expiry", "follow_up",
]);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// --- tables ---
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  locale: text("locale").notNull().default("th"),
  consentVersion: integer("consent_version"),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const emergencyProfiles = pgTable("emergency_profiles", {
  id: id(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  firstNameThEnc: text("first_name_th_enc"),
  lastNameThEnc: text("last_name_th_enc"),
  nameEnEnc: text("name_en_enc"),
  dob: date("dob"),
  sex: sex("sex").notNull().default("unspecified"),
  photoPath: text("photo_path"),
  bloodAbo: bloodAbo("blood_abo").notNull().default("unknown"),
  bloodRh: bloodRh("blood_rh").notNull().default("unknown"),
  noKnownDrugAllergy: boolean("no_known_drug_allergy").notNull().default(false),
  flags: jsonb("flags").notNull().default({}),
  insuranceScheme: insuranceScheme("insurance_scheme").notNull().default("unknown"),
  preferredLanguage: text("preferred_language").notNull().default("th"),
  notesEnc: text("notes_enc"),
  lockScreenFields: jsonb("lock_screen_fields").notNull(),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const allergies = pgTable("allergies", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  substanceEnEnc: text("substance_en_enc"),
  substanceThEnc: text("substance_th_enc"),
  category: allergyCategory("category").notNull().default("medication"),
  reactionEnc: text("reaction_enc"),
  severity: allergySeverity("severity").notNull().default("moderate"),
  source: allergySource("source").notNull().default("self"),
  notedAt: timestamp("noted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("allergies_user_idx").on(t.userId)]);

export const conditions = pgTable("conditions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code"),
  labelThEnc: text("label_th_enc"),
  labelEnEnc: text("label_en_enc"),
  status: conditionStatus("status").notNull().default("active"),
  onsetYear: integer("onset_year"),
  critical: boolean("critical").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("conditions_user_idx").on(t.userId)]);

export const medications = pgTable("medications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nameEnc: text("name_enc").notNull(),
  strengthEnc: text("strength_enc"),
  doseEnc: text("dose_enc"),
  frequencyThEnc: text("frequency_th_enc"),
  critical: boolean("critical").notNull().default(false),
  status: medStatus("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("medications_user_idx").on(t.userId)]);

export const emergencyContacts = pgTable("emergency_contacts", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nameEnc: text("name_enc").notNull(),
  relationship: text("relationship"),
  phoneEnc: text("phone_enc").notNull(),
  informedConsent: boolean("informed_consent").notNull().default(false),
  priority: integer("priority").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("contacts_user_idx").on(t.userId)]);

export const medicalRecords = pgTable("medical_records", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: recordKind("kind").notNull().default("other"),
  status: recordStatus("status").notNull().default("pending"),
  titleEnc: text("title_enc"),
  facilityEnc: text("facility_enc"),
  doctorNameEnc: text("doctor_name_enc"),
  doctorLicenseNoEnc: text("doctor_license_no_enc"),
  issuedAt: date("issued_at"),
  validUntil: date("valid_until"),
  storagePath: text("storage_path"),
  mime: text("mime"),
  sizeBytes: integer("size_bytes"),
  sha256: text("sha256").notNull(),
  notesEnc: text("notes_enc"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("records_user_sha_uidx").on(t.userId, t.sha256)]);

export const extractions = pgTable("extractions", {
  id: id(),
  recordId: uuid("record_id").notNull().references(() => medicalRecords.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model"),
  source: extractionSource("source").notNull().default("live"),
  rawTextEnc: text("raw_text_enc"),
  extractionJsonEnc: text("extraction_json_enc"),
  fieldMeta: jsonb("field_meta"),
  imageQuality: imageQuality("image_quality"),
  latencyMs: integer("latency_ms"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("extractions_record_idx").on(t.recordId)]);

export const shareLinks = pgTable("share_links", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  // Raw token retained only for scope=emergency (a public capability reprinted on
  // the card/QR); null for scope=records (clinician links, shown once, hash only).
  token: text("token"),
  scope: shareScope("scope").notNull(),
  recordIds: uuid("record_ids").array(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  maxViews: integer("max_views"),
  viewCount: integer("view_count").notNull().default(0),
  passcodeHash: text("passcode_hash"),
  failedPasscodes: integer("failed_passcodes").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("share_links_user_idx").on(t.userId)]);

export const shareAccessLog = pgTable("share_access_log", {
  id: id(),
  shareLinkId: uuid("share_link_id").notNull().references(() => shareLinks.id, { onDelete: "cascade" }),
  accessedAt: timestamp("accessed_at", { withTimezone: true }).notNull().defaultNow(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  outcome: shareOutcome("outcome").notNull(),
}, (t) => [index("share_access_link_idx").on(t.shareLinkId)]);

export const consents = pgTable("consents", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  purposes: jsonb("purposes").notNull(),
  granted: boolean("granted").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("consents_user_idx").on(t.userId)]);

export const refreshTokens = pgTable("refresh_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  replacedBy: uuid("replaced_by"),
  createdAt: createdAt(),
}, (t) => [index("refresh_user_idx").on(t.userId)]);

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: notificationKind("kind").notNull(),
  payload: jsonb("payload"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("notifications_user_idx").on(t.userId)]);

export const deletedUsers = pgTable("deleted_users", {
  id: id(),
  emailHash: text("email_hash").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  users, emergencyProfiles, allergies, conditions, medications, emergencyContacts,
  medicalRecords, extractions, shareLinks, shareAccessLog, consents, refreshTokens,
  notifications, deletedUsers,
};
