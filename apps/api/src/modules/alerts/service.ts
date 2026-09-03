import { eq } from "drizzle-orm";
import type { NotificationKind } from "@mfc/shared";
import type { AppContext } from "../../context.js";
import { env } from "../../config/env.js";
import { notifications, users } from "../../db/schema.js";
import type { FetchLike } from "../extract/providers/common.js";
import { sendEmail, alertEmailContent } from "./email.js";

// A4 automation workflow: a public-page view (card scanned, clinician link opened,
// link revoked) -> an in-app notification row for the owner (always) -> an e-mail to
// the owner's account address when Resend is configured. The e-mail never blocks or
// fails the public page; delivery problems are logged without secrets.

export interface AlertEmailSettings {
  /** Resend API key; empty/undefined = in-app notifications only. */
  apiKey?: string | undefined;
  from: string;
  /**
   * Optional override recipient. Resend's free tier without a verified domain can only
   * deliver to the account owner's address, so demos set ALERT_EMAIL_TO to that address;
   * in production leave it empty and every user gets mail at their own account e-mail.
   */
  overrideTo?: string | undefined;
  fetchImpl?: FetchLike;
  retryBaseMs?: number;
}

function settingsFromEnv(): AlertEmailSettings {
  return { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM, overrideTo: env.ALERT_EMAIL_TO };
}

let testSettings: AlertEmailSettings | null = null;
/** Tests inject a fake fetch + key here; env is fixed at import time. */
export function setAlertEmailForTest(s: AlertEmailSettings | null): void {
  testSettings = s;
}

/** Who the alert e-mail goes to: the override when set, otherwise the owner's account e-mail. */
export async function alertRecipient(ctx: AppContext, userId: string, overrideTo?: string): Promise<string | null> {
  const override = overrideTo?.trim();
  if (override) return override;
  const [u] = await ctx.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return u?.email ?? null;
}

async function notifyByEmail(ctx: AppContext, args: { userId: string; kind: NotificationKind }, s: AlertEmailSettings): Promise<void> {
  if (!s.apiKey) return;
  const to = await alertRecipient(ctx, args.userId, s.overrideTo);
  if (!to) return;
  try {
    await sendEmail({ to, ...alertEmailContent(args.kind, new Date()) }, { apiKey: s.apiKey, from: s.from, fetchImpl: s.fetchImpl, retryBaseMs: s.retryBaseMs });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[alert] e-mail for ${args.kind} not sent: ${e instanceof Error ? e.message.slice(0, 200) : "error"}`);
  }
}

export async function recordView(
  ctx: AppContext,
  args: { userId: string; kind: NotificationKind; meta: Record<string, unknown> },
  opts: { email?: AlertEmailSettings } = {},
): Promise<void> {
  await ctx.db.insert(notifications).values({ userId: args.userId, kind: args.kind, payload: args.meta });
  const s = opts.email ?? testSettings ?? settingsFromEnv();
  if (!s.apiKey) return; // in-app only (no Resend key)
  // Fire and forget: the rescuer/clinician page must not wait for the mail provider.
  void notifyByEmail(ctx, args, s);
}
