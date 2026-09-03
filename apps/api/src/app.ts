import express, { Router, type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import type { AppContext } from "./context.js";
import { healthRouter } from "./modules/health/routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./auth/routes.js";
import { profileRoutes } from "./modules/profile/routes.js";
import { recordsRoutes } from "./modules/records/routes.js";
import { extractRoutes } from "./modules/extract/routes.js";
import { shareRoutes } from "./modules/share/routes.js";
import { notificationsRoutes } from "./modules/notifications/routes.js";
import { consentRoutes } from "./modules/consent/routes.js";
import { publicRoutes } from "./modules/public/routes.js";

// Builds the Express app without listening, so tests can drive it with supertest.
export function createApp(ctx: AppContext): Express {
  const app = express();

  // Render puts the API behind a single reverse-proxy hop; trust it so req.ip is
  // the real client and the rate limiters key per visitor (PLAN §11).
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS === "*" ? true : env.CORS_ORIGINS.split(",").map((s) => s.trim()),
    }),
  );
  app.use(
    pinoHttp({
      redact: ["req.headers.authorization", "req.body.password", "req.body.pin"],
      autoLogging: env.NODE_ENV !== "test",
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false })); // clinician passcode form

  // Unprefixed ops routes.
  app.use(healthRouter);

  // API v1 modules.
  const v1 = Router();
  v1.use(authRoutes(ctx));
  v1.use(profileRoutes(ctx));
  v1.use(recordsRoutes(ctx));
  v1.use(extractRoutes(ctx));
  v1.use(shareRoutes(ctx));
  v1.use(notificationsRoutes(ctx));
  v1.use(consentRoutes(ctx));
  app.use("/api/v1", v1);

  // Unprefixed public pages: /e/:token (rescuer), /s/:token (clinician).
  app.use(publicRoutes(ctx));

  app.use(errorHandler);
  return app;
}
