import { z } from "zod";

// Phase 0 keeps most integration keys optional so the API boots for the health
// scaffold. As auth/db/storage/AI modules land (W2-W3), tighten the ones each
// module needs (or validate them at module load).
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_VERSION: z.string().default("0.1.0"),
  // 0 = do not trust proxy (local); 1 = trust first hop (Render). See PLAN §11.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  CORS_ORIGINS: z.string().default("*"),

  STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  EXTRACT_PROVIDER: z.enum(["gemini", "mock"]).default("mock"),
  OCR_PROVIDER: z.enum(["typhoon", "none"]).default("none"),

  // Optional in Phase 0; required by the modules that use them.
  DATABASE_URL: z.string().optional(),
  PGSSL: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  FIELD_ENC_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default("records"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  TYPHOON_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  ALERT_EMAIL_TO: z.string().optional(),
  RESEND_FROM: z.string().default("onboarding@resend.dev"),
  // Render injects RENDER_EXTERNAL_URL (https://<service>.onrender.com); use it when
  // PUBLIC_BASE_URL is not set so QR codes and share links carry the real public URL.
  PUBLIC_BASE_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim()) || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000")
    .transform((v) => v.replace(/\/+$/, "")),
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    // eslint-disable-next-line no-console
    console.error("Invalid environment configuration:", JSON.stringify(fields, null, 2));
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
