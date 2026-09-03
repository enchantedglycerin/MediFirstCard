import { Router } from "express";
import { env } from "../../config/env.js";
import { isEncryptionConfigured } from "../../crypto/fieldEncryption.js";

const startedAt = Date.now();

export const healthRouter: Router = Router();

// Used by Render's health check, UptimeRobot, and the demo "which IP am I" check.
// The app reads `extractProvider` from /health for the first-scan consent sheet.
healthRouter.get("/health", (req, res) => {
  res.json({
    ok: true,
    version: env.APP_VERSION,
    uptime: Math.round((Date.now() - startedAt) / 1000),
    ip: req.ip,
    extractProvider: env.EXTRACT_PROVIDER,
    storageProvider: env.STORAGE_PROVIDER,
    encryption: isEncryptionConfigured() ? "on" : "unconfigured",
  });
});

// The real SELECT 1 lands in W2 when the pg pool exists; report cleanly until then.
healthRouter.get("/health/db", (_req, res) => {
  res.json({ ok: true, db: env.DATABASE_URL ? "configured" : "not-configured" });
});
