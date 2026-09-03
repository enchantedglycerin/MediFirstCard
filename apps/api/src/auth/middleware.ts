import type { RequestHandler } from "express";
import { verifyAccessToken } from "./tokens.js";

export function requireAuth(): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ code: "UNAUTHENTICATED", message: "Missing bearer token" });
      return;
    }
    try {
      req.userId = await verifyAccessToken(header.slice("Bearer ".length));
      next();
    } catch {
      res.status(401).json({ code: "UNAUTHENTICATED", message: "Invalid or expired token" });
    }
  };
}
