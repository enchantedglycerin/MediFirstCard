import { Linking, Platform } from "react-native";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import { secure, KEYS } from "./secure";

// The pinned card is an ordinary notification, so it survives normal background killing.
// What removes it is a force-stop (Xiaomi/HyperOS "Restricted" battery saver, Samsung
// deep sleep) and, on Xiaomi, a reboot without the Autostart permission. Each of the two
// settings lives on its own page; these helpers open the right one and fall back to
// App info when a vendor page is missing.

export type Vendor = "xiaomi" | "samsung" | "other";
export type KeepAliveStep = "autostart" | "battery";

const PKG = Constants.expoConfig?.android?.package ?? "com.medifirstcard.app";

export function vendor(): Vendor {
  const m = `${Device.manufacturer ?? ""} ${Device.brand ?? ""}`.toLowerCase();
  if (/xiaomi|redmi|poco/.test(m)) return "xiaomi";
  if (/samsung/.test(m)) return "samsung";
  return "other";
}

/** Settings this phone needs; Autostart exists only on Xiaomi. */
export function keepAliveSteps(v: Vendor = vendor()): KeepAliveStep[] {
  return v === "xiaomi" ? ["autostart", "battery"] : ["battery"];
}

/** True when the app is exempt from battery optimization (the system-level "Unrestricted"). */
export async function isBatteryUnrestricted(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    return !(await Battery.isBatteryOptimizationEnabledAsync());
  } catch {
    return true;
  }
}

/** Autostart cannot be read back, so it counts as done once the person has opened its page. */
export async function isAutostartConfirmed(): Promise<boolean> {
  return (await secure.get(KEYS.autostartDone)) === "1";
}
export async function markAutostartConfirmed(): Promise<void> {
  await secure.set(KEYS.autostartDone, "1");
}

export async function wasKeepAliveAsked(): Promise<boolean> {
  return (await secure.get(KEYS.keepAliveAsked)) === "1";
}
export async function markKeepAliveAsked(): Promise<void> {
  await secure.set(KEYS.keepAliveAsked, "1");
}

/** Try each launcher in order; the last resort is the app's own App info page. */
async function firstThatOpens(attempts: Array<() => Promise<unknown>>): Promise<void> {
  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch {
      // that page does not exist on this phone; try the next one
    }
  }
  await Linking.openSettings();
}

/** Xiaomi Security app -> Autostart manager; falls back to App info (the toggle is there too). */
export async function openAutostartSettings(): Promise<void> {
  await firstThatOpens([
    () => IntentLauncher.startActivityAsync("miui.intent.action.OP_AUTO_START"),
    () => IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
      packageName: "com.miui.securitycenter",
      className: "com.miui.permcenter.autostart.AutoStartManagementActivity",
    }),
  ]);
  await markAutostartConfirmed();
}

/**
 * Xiaomi: the app's own Battery saver page. Everyone else: the system
 * "Allow app to run in background?" dialog, which sets Unrestricted in one tap.
 */
export async function openBatterySettings(): Promise<void> {
  const requestDialog = () =>
    IntentLauncher.startActivityAsync("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", { data: `package:${PKG}` });
  const miuiPage = () =>
    IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
      packageName: "com.miui.powerkeeper",
      className: "com.miui.powerkeeper.ui.HiddenAppsConfigActivity",
      extra: { package_name: PKG, package_label: "MediFirstCard" },
    });
  await firstThatOpens(vendor() === "xiaomi" ? [miuiPage, requestDialog] : [requestDialog]);
}
