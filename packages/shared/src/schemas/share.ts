import { z } from "zod";

export const shareScope = z.enum(["emergency", "records"]);

export const createShareLinkInput = z.object({
  recordIds: z.array(z.string().uuid()).min(1).max(50),
  ttlHours: z.number().int().min(1).max(168).default(24),
  passcode: z.string().regex(/^\d{4}$/, "invalid_passcode").optional(),
  maxViews: z.number().int().min(1).max(100).optional(),
});

export const shareAccessOutcome = z.enum([
  "ok", "expired", "revoked", "not_found", "bad_passcode",
]);

export const notificationKind = z.enum([
  "card_viewed", "share_viewed", "share_revoked", "expiry", "follow_up",
]);

export type CreateShareLinkInput = z.infer<typeof createShareLinkInput>;
export type ShareScope = z.infer<typeof shareScope>;
export type NotificationKind = z.infer<typeof notificationKind>;
