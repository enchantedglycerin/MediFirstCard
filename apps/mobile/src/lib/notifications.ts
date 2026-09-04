import * as Notifications from "expo-notifications";
import { EMERGENCY_NUMBER, NO_KNOWN_DRUG_ALLERGY, notificationTitle, type CardLine, type CardPayload } from "@mfc/shared";
import i18n from "../i18n";
import { secure, KEYS } from "./secure";
import { hideLockCard, isLockCardShown, showLockCard } from "../../modules/lock-card";

// The lock-screen card is a permanent local notification on a MAX-importance channel with
// PUBLIC lock-screen visibility, so its text is readable without unlocking the phone.
// It is posted by the native lock-card module (modules/lock-card): ongoing, silent, with a
// "Call 1669" action, re-posted the moment the user swipes it away and again after a reboot
// or app update. expo-notifications is kept for the permission prompt and the channel name.

const CHANNEL = "emergency-card";
const COLOR = "#C62828";
/** Identifier of the pre-1.0.6 expo-notifications card, dismissed once so it cannot linger next to the new one. */
const LEGACY_ID = "mfc-lock-card";

type Payload = Pick<CardPayload, "lines" | "lastReviewedAt">;

const LABEL_KEY: Record<CardLine["kind"], string> = {
  identity: "card.identity",
  blood: "card.bloodShort",
  allergy: "card.allergy",
  condition: "card.condition",
  medication: "card.medication",
  contact: "card.ice",
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function ensureChannel(name: string): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name,
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: null,
    vibrationPattern: [0],
    enableVibrate: false,
    showBadge: false,
  });
}

/**
 * What the notification says, in the user's language. Android already prints the app name in
 * the header, so the bold title carries data instead: "Emergency · O− · Somchai Jaidee". The
 * body lists everything else once (allergies, conditions, medications, ICE contacts).
 */
export function lockCardText(payload: Payload): { title: string; lines: string[] } {
  const t = (key: string) => i18n.t(key);
  const title = notificationTitle(payload, t("lockScreen.notificationTitle"));
  const lines = payload.lines
    .filter((l) => l.kind !== "identity" && l.kind !== "blood")
    .map((l) => {
      if (l.kind === "allergy" && l.value === NO_KNOWN_DRUG_ALLERGY) return `${t("card.allergies")}: ${t("card.noKnownAllergy")}`;
      return `${t(LABEL_KEY[l.kind])}: ${l.value}`;
    });
  return { title, lines: lines.length > 0 ? lines : [t("lockScreen.title")] };
}

/** Post (or refresh) the pinned card. Returns false when permission is missing. */
export async function showLockScreenCard(payload: Payload): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false;
  await ensureChannel(i18n.t("lockScreen.title"));
  await Notifications.dismissNotificationAsync(LEGACY_ID).catch(() => undefined);
  const { title, lines } = lockCardText(payload);
  const ok = await showLockCard({
    title,
    lines,
    channelId: CHANNEL,
    callLabel: i18n.t("card.call1669"),
    callNumber: EMERGENCY_NUMBER,
    color: COLOR,
  });
  if (ok) await secure.set(KEYS.lockCard, "1");
  return ok;
}

export async function hideLockScreenCard(): Promise<void> {
  await hideLockCard();
  await Notifications.dismissNotificationAsync(LEGACY_ID).catch(() => undefined);
  await secure.del(KEYS.lockCard);
}

/**
 * Ask for every runtime permission the app uses, once, right after sign-in: notifications
 * (lock-screen card), camera and photos (document scan). Later features then never
 * surprise the user with a system dialog mid-task. Returns true when it ran this time.
 */
export async function requestAllPermissionsOnce(): Promise<boolean> {
  if ((await secure.get(KEYS.permsAsked)) === "1") return false;
  const { requestCameraPermissionsAsync, requestMediaLibraryPermissionsAsync } = await import("expo-image-picker");
  await Notifications.requestPermissionsAsync().catch(() => undefined);
  await requestCameraPermissionsAsync().catch(() => undefined);
  await requestMediaLibraryPermissionsAsync().catch(() => undefined);
  await secure.set(KEYS.permsAsked, "1");
  return true;
}

export async function isLockScreenCardOn(): Promise<boolean> {
  return (await secure.get(KEYS.lockCard)) === "1";
}

/**
 * If the card was turned on but is not currently presented (first launch after an update,
 * permission granted late, a device that dropped it), fetch the latest payload and pin it
 * again. Called on launch and on resume; `force` re-posts even when it is already showing.
 */
export async function ensureLockScreenCardPinned(
  fetchCard: () => Promise<Payload>,
  opts: { force?: boolean } = {},
): Promise<boolean> {
  const log = (msg: string) => console.log(`[lockcard] ${msg}`); // kept in release builds: cheap, no personal data
  if (!(await isLockScreenCardOn())) { log("flag off, nothing to re-pin"); return false; }
  try {
    if (!opts.force && (await isLockCardShown())) { log("already presented"); return true; }
    log("fetching card");
    const card = await fetchCard();
    if (card.lines.length === 0) { log("card empty, not pinning"); return false; }
    const ok = await showLockScreenCard({ lines: card.lines, lastReviewedAt: card.lastReviewedAt });
    log(ok ? `pinned ${card.lines.length} lines` : "permission missing, not pinned");
    return ok;
  } catch (e) {
    log(`re-pin failed: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    return false;
  }
}
