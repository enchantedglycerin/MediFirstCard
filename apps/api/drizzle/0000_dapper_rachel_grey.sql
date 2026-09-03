CREATE TYPE "public"."allergy_category" AS ENUM('medication', 'food', 'environment');--> statement-breakpoint
CREATE TYPE "public"."allergy_severity" AS ENUM('mild', 'moderate', 'severe');--> statement-breakpoint
CREATE TYPE "public"."allergy_source" AS ENUM('self', 'hospital_card');--> statement-breakpoint
CREATE TYPE "public"."blood_abo" AS ENUM('A', 'B', 'AB', 'O', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."blood_rh" AS ENUM('pos', 'neg', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."condition_status" AS ENUM('active', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."extraction_source" AS ENUM('live', 'mock');--> statement-breakpoint
CREATE TYPE "public"."image_quality" AS ENUM('good', 'fair', 'poor');--> statement-breakpoint
CREATE TYPE "public"."insurance_scheme" AS ENUM('ucs', 'sss', 'csmbs', 'private', 'self_pay', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."med_status" AS ENUM('active', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('card_viewed', 'share_viewed', 'share_revoked', 'expiry', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."record_kind" AS ENUM('certificate_general', 'certificate_driving', 'certificate_5disease', 'sick_leave', 'prescription', 'lab', 'vaccine', 'allergy_card', 'discharge', 'receipt', 'other');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('pending', 'uploaded', 'extracted', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'other', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."share_outcome" AS ENUM('ok', 'expired', 'revoked', 'not_found', 'bad_passcode');--> statement-breakpoint
CREATE TYPE "public"."share_scope" AS ENUM('emergency', 'records');--> statement-breakpoint
CREATE TABLE "allergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"substance_en_enc" text,
	"substance_th_enc" text,
	"category" "allergy_category" DEFAULT 'medication' NOT NULL,
	"reaction_enc" text,
	"severity" "allergy_severity" DEFAULT 'moderate' NOT NULL,
	"source" "allergy_source" DEFAULT 'self' NOT NULL,
	"noted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text,
	"label_th_enc" text,
	"label_en_enc" text,
	"status" "condition_status" DEFAULT 'active' NOT NULL,
	"onset_year" integer,
	"critical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"purposes" jsonb NOT NULL,
	"granted" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deleted_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name_enc" text NOT NULL,
	"relationship" text,
	"phone_enc" text NOT NULL,
	"informed_consent" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name_th_enc" text,
	"last_name_th_enc" text,
	"name_en_enc" text,
	"dob" date,
	"sex" "sex" DEFAULT 'unspecified' NOT NULL,
	"photo_path" text,
	"blood_abo" "blood_abo" DEFAULT 'unknown' NOT NULL,
	"blood_rh" "blood_rh" DEFAULT 'unknown' NOT NULL,
	"no_known_drug_allergy" boolean DEFAULT false NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"insurance_scheme" "insurance_scheme" DEFAULT 'unknown' NOT NULL,
	"preferred_language" text DEFAULT 'th' NOT NULL,
	"notes_enc" text,
	"lock_screen_fields" jsonb NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emergency_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"source" "extraction_source" DEFAULT 'live' NOT NULL,
	"raw_text_enc" text,
	"extraction_json_enc" text,
	"field_meta" jsonb,
	"image_quality" "image_quality",
	"latency_ms" integer,
	"tokens_in" integer,
	"tokens_out" integer,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "record_kind" DEFAULT 'other' NOT NULL,
	"status" "record_status" DEFAULT 'pending' NOT NULL,
	"title_enc" text,
	"facility_enc" text,
	"doctor_name_enc" text,
	"doctor_license_no_enc" text,
	"issued_at" date,
	"valid_until" date,
	"storage_path" text,
	"mime" text,
	"size_bytes" integer,
	"sha256" text NOT NULL,
	"notes_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name_enc" text NOT NULL,
	"strength_enc" text,
	"dose_enc" text,
	"frequency_th_enc" text,
	"critical" boolean DEFAULT false NOT NULL,
	"status" "med_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "share_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_link_id" uuid NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"outcome" "share_outcome" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"token" text,
	"scope" "share_scope" NOT NULL,
	"record_ids" uuid[],
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"max_views" integer,
	"view_count" integer DEFAULT 0 NOT NULL,
	"passcode_hash" text,
	"failed_passcodes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"locale" text DEFAULT 'th' NOT NULL,
	"consent_version" integer,
	"consented_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_profiles" ADD CONSTRAINT "emergency_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_record_id_medical_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."medical_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_access_log" ADD CONSTRAINT "share_access_log_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allergies_user_idx" ON "allergies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conditions_user_idx" ON "conditions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contacts_user_idx" ON "emergency_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "extractions_record_idx" ON "extractions" USING btree ("record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "records_user_sha_uidx" ON "medical_records" USING btree ("user_id","sha256");--> statement-breakpoint
CREATE INDEX "medications_user_idx" ON "medications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "share_access_link_idx" ON "share_access_log" USING btree ("share_link_id");--> statement-breakpoint
CREATE INDEX "share_links_user_idx" ON "share_links" USING btree ("user_id");