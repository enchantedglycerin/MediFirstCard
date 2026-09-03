import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import type { AppContext } from "../../context.js";
import { requireAuth } from "../../auth/middleware.js";
import { notifications } from "../../db/schema.js";

const uid = (req: { userId?: string }) => req.userId as string;

export function notificationsRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth());

  r.get("/me/notifications", async (req, res, next) => {
    try {
      const rows = await ctx.db.select().from(notifications)
        .where(eq(notifications.userId, uid(req))).orderBy(desc(notifications.createdAt)).limit(100);
      res.json(rows);
    } catch (e) { next(e); }
  });

  r.post("/me/notifications/:id/read", async (req, res, next) => {
    try {
      await ctx.db.update(notifications).set({ readAt: new Date() })
        .where(and(eq(notifications.id, req.params.id as string), eq(notifications.userId, uid(req))));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  return r;
}
