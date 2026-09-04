import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { notificationTitle, type CardPayload } from "@mfc/shared";
import { secure, KEYS } from "./secure";

// The lock-screen card is a pinned (sticky, non-dismissable) local notification on a
// MAX-importance channel with PUBLIC lock-screen visibility, so its text is readable
// without unlocking the phone. It is re-posted whenever the card payload changes.

const ID = "mfc-lock-card";
const CHANNEL = "emergency-card";

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
  if (Platform.OS !== "android") return;
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

/** Post (or refresh) the pinned card. Returns false when permission is missing. */
export async function showLockScreenCard(payload: CardPayload, opts: { channelName: string; footer?: string }): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false;
  await ensureChannel(opts.channelName);
  await Notifications.dismissNotificationAsync(ID).catch(() => undefined);
  const lines = payload.lines.map((l) => `${l.label}: ${l.value}`);
  if (opts.footer) lines.push(opts.footer);
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: notificationTitle(payload),
      body: lines.join("\n"),
      sticky: true,
      autoDismiss: false,
      color: "#C62828",
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { kind: "lock-card" },
    },
    trigger: Platform.OS === "android" ? { channelId: CHANNEL } : null,
  });
  await secure.set(KEYS.lockCard, "1");
  return true;
}

export async function hideLockScreenCard(): Promise<void> {
  await Notifications.dismissNotificationAsync(ID).catch(() => undefined);
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
 * Android drops an app's notifications when the app is updated or reinstalled, and the
 * user can clear them from the shade. If the card was turned on but is not currently
 * presented, fetch the latest payload and pin it again. Called on launch and on resume.
 */
export async function ensureLockScreenCardPinned(
  fetchCard: () => Promise<Pick<CardPayload, "lines" | "lastReviewedAt">>,
  opts: { channelName: string; footer?: string },
): Promise<boolean> {
  const log = (msg: string) => console.log(`[lockcard] ${msg}`); // kept in release builds: cheap, no personal data
  if (!(await isLockScreenCardOn())) { log("flag off, nothing to re-pin"); return false; }
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    if (presented.some((n) => n.request.identifier === ID)) { log("already presented"); return true; }
    log(`not presented (${presented.length} other), fetching card`);
    const card = await fetchCard();
    if (card.lines.length === 0) { log("card empty, not pinning"); return false; }
    const ok = await showLockScreenCard({ lines: card.lines, lastReviewedAt: card.lastReviewedAt }, opts);
    log(ok ? `re-pinned ${card.lines.length} lines` : "permission missing, not pinned");
    return ok;
  } catch (e) {
    log(`re-pin failed: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    return false;
  }
}
