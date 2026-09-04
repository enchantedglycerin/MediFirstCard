import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

// Android-only local Expo module that pins a permanent "emergency card" notification.
// Unlike the expo-notifications sticky card, this one is re-posted immediately when the
// user swipes it away (via a deleteIntent -> BroadcastReceiver) and re-posted on reboot
// and app update, so rescuers can always read it from the lock screen.
//
// On iOS / web / tests requireOptionalNativeModule returns null instead of throwing, and
// every exported function additionally short-circuits on Platform.OS !== "android".

export type LockCardOptions = {
  title: string;
  lines: string[];
  channelId: string;
  callLabel: string;
  callNumber: string;
  color?: string;
};

type LockCardNativeModule = {
  show(opts: LockCardOptions): Promise<boolean>;
  hide(): Promise<void>;
  isShown(): Promise<boolean>;
};

const LockCard = requireOptionalNativeModule<LockCardNativeModule>("LockCard");

/** Post (or refresh) the pinned emergency card. Resolves false when notifications are not permitted. */
export async function showLockCard(opts: LockCardOptions): Promise<boolean> {
  if (Platform.OS !== "android" || !LockCard) return false;
  return LockCard.show(opts);
}

/** Remove the pinned card and forget the stored payload so it does not come back on reboot. */
export async function hideLockCard(): Promise<void> {
  if (Platform.OS !== "android" || !LockCard) return;
  await LockCard.hide();
}

/** Whether the card is currently presented in the status bar. */
export async function isLockCardShown(): Promise<boolean> {
  if (Platform.OS !== "android" || !LockCard) return false;
  return LockCard.isShown();
}
