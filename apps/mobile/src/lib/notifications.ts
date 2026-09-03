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

export async function isLockScreenCardOn(): Promise<boolean> {
  return (await secure.get(KEYS.lockCard)) === "1";
}
