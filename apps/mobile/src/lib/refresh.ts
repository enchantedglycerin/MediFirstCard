import { queryClient } from "./query";
import { api } from "./api";
import { hideLockScreenCard, isLockScreenCardOn, showLockScreenCard } from "./notifications";

export type EditKind = "profile" | "allergies" | "conditions" | "medications" | "contacts" | "lockScreenFields";

/** Query keys each kind of edit makes stale (the emergency card always is). */
const STALE: Record<EditKind, string[]> = {
  profile: ["profile"],
  allergies: ["allergies", "profile"], // adding an allergy clears the "none known" flag on the server
  conditions: ["conditions"],
  medications: ["medications"],
  contacts: ["contacts"],
  lockScreenFields: ["profile"],
};

/**
 * One call after any successful edit: refetch every screen that shows the data
 * (home, card tab, profile, lock-screen preview) and re-post the pinned card so the
 * lock screen never shows yesterday's allergies.
 */
export async function invalidateAfterEdit(kind: EditKind): Promise<void> {
  await Promise.all([...STALE[kind], "emergency-card"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
  await repinLockScreenCard();
}

/** Re-post the pinned card from the latest server payload; a no-op while the card is off. */
export async function repinLockScreenCard(): Promise<void> {
  if (!(await isLockScreenCardOn())) return;
  try {
    const card = await queryClient.fetchQuery({ queryKey: ["emergency-card"], queryFn: api.emergencyCard, staleTime: 0 });
    if (card.lines.length === 0) { await hideLockScreenCard(); return; }
    await showLockScreenCard({ lines: card.lines, lastReviewedAt: card.lastReviewedAt });
  } catch {
    // Best effort: the previous pin stays until the next launch/resume re-pin.
  }
}
