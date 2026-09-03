import type { AppContext } from "../../context.js";
import { env } from "../../config/env.js";
import { notifications } from "../../db/schema.js";
import type { NotificationKind } from "@mfc/shared";

// A4: a public-page view -> an in-app notification row (the MUST) + an email when
// configured. Resend is wired at deploy time; until then we log the intent so the
// in-app notification alone satisfies the workflow.
export async function recordView(
  ctx: AppContext,
  args: { userId: string; kind: NotificationKind; meta: Record<string, unknown> },
): Promise<void> {
  await ctx.db.insert(notifications).values({ userId: args.userId, kind: args.kind, payload: args.meta });
  if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO) {
    // eslint-disable-next-line no-console
    console.log(`[alert] email -> ${env.ALERT_EMAIL_TO}: ${args.kind}`);
    // Resend send() wired at deploy time (dep added then).
  } else {
    // eslint-disable-next-line no-console
    console.log(`[alert] ${args.kind} for user ${args.userId} (email skipped: RESEND not configured)`);
  }
}
