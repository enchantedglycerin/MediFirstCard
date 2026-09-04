import { Linking, Platform } from "react-native";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import { secure, KEYS } from "./secure";

// The pinned card is an ordinary notification, so it survives normal background killing.
// What removes it is a force-stop (vendor battery savers, Samsung deep sleep) and, on phones
// with an "Autostart" permission, a reboot without it. Each setting lives on its own page;
// these helpers open the right one for the vendor and fall back to App info when a page
// is missing on this particular firmware.

export type KeepAliveStep = "autostart" | "battery";

const PKG = Constants.expoConfig?.android?.package ?? "com.medifirstcard.app";
const APP_LABEL = "MediFirstCard";

/** A settings activity to try; the first one that exists wins. */
interface Page { pkg: string; cls: string; extra?: Record<string, string> }

interface VendorPages {
  match: RegExp;
  /** Autostart / auto-launch / app-launch manager. Absent when the vendor has no such permission. */
  autostart?: Page[];
  /** Vendor's own per-app battery page, tried before the system dialog. */
  battery?: Page[];
  /** An intent action that opens the same manager, tried after the components. */
  autostartAction?: string;
}

// Component names verified against the AutoStarter library (judemanutd/AutoStarter, master) on
// 2026-09-04; the MIUI battery page, MIUI action, vivo battery page, Meizu and Samsung China
// entries come from its companion references and are unverified on a device.
const VENDORS: VendorPages[] = [
  {
    match: /xiaomi|redmi|poco/,
    autostart: [{ pkg: "com.miui.securitycenter", cls: "com.miui.permcenter.autostart.AutoStartManagementActivity" }],
    battery: [{ pkg: "com.miui.powerkeeper", cls: "com.miui.powerkeeper.ui.HiddenAppsConfigActivity", extra: { package_name: PKG, package_label: APP_LABEL } }],
  },
  {
    match: /huawei/,
    autostart: [
      { pkg: "com.huawei.systemmanager", cls: "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
      { pkg: "com.huawei.systemmanager", cls: "com.huawei.systemmanager.optimize.process.ProtectActivity" },
    ],
  },
  { match: /honor/, autostart: [{ pkg: "com.huawei.systemmanager", cls: "com.huawei.systemmanager.optimize.process.ProtectActivity" }] },
  {
    match: /oneplus/,
    autostart: [
      { pkg: "com.oneplus.security", cls: "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity" },
      { pkg: "com.coloros.safecenter", cls: "com.coloros.safecenter.permission.startup.StartupAppListActivity" },
    ],
    autostartAction: "com.android.settings.action.BACKGROUND_OPTIMIZE",
  },
  {
    match: /oppo|realme/,
    autostart: [
      { pkg: "com.coloros.safecenter", cls: "com.coloros.safecenter.permission.startup.StartupAppListActivity" },
      { pkg: "com.oppo.safe", cls: "com.oppo.safe.permission.startup.StartupAppListActivity" },
      { pkg: "com.coloros.safecenter", cls: "com.coloros.safecenter.startupapp.StartupAppListActivity" },
      { pkg: "com.color.safecenter", cls: "com.color.safecenter.permission.startup.StartupAppListActivity" },
    ],
  },
  {
    match: /vivo|iqoo/,
    autostart: [
      { pkg: "com.iqoo.secure", cls: "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity" },
      { pkg: "com.vivo.permissionmanager", cls: "com.vivo.permissionmanager.activity.BgStartUpManagerActivity" },
      { pkg: "com.iqoo.secure", cls: "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager" },
    ],
    battery: [{ pkg: "com.vivo.abe", cls: "com.vivo.applicationbehaviorengine.ui.ExcessivePowerManagerActivity" }],
  },
  {
    match: /asus/,
    autostart: [
      { pkg: "com.asus.mobilemanager", cls: "com.asus.mobilemanager.powersaver.PowerSaverSettings" },
      { pkg: "com.asus.mobilemanager", cls: "com.asus.mobilemanager.autostart.AutoStartActivity" },
    ],
  },
  { match: /letv/, autostart: [{ pkg: "com.letv.android.letvsafe", cls: "com.letv.android.letvsafe.AutobootManageActivity" }] },
  { match: /nokia|hmd/, autostart: [{ pkg: "com.evenwell.powersaving.g3", cls: "com.evenwell.powersaving.g3.exception.PowerSaverExceptionActivity" }] },
  { match: /tecno|infinix|itel|transsion/, autostart: [{ pkg: "com.transsion.phonemanager", cls: "com.itel.autobootmanager.activity.AutoBootMgrActivity" }] },
  {
    match: /meizu/,
    autostart: [
      { pkg: "com.meizu.safe", cls: "com.meizu.safe.powerui.PowerAppPermissionActivity" },
      { pkg: "com.meizu.safe", cls: "com.meizu.safe.permission.SmartBGActivity" },
    ],
  },
  {
    match: /samsung/,
    battery: [
      { pkg: "com.samsung.android.lool", cls: "com.samsung.android.sm.ui.battery.BatteryActivity" },
      { pkg: "com.samsung.android.lool", cls: "com.samsung.android.sm.battery.ui.usage.CheckableAppListActivity" },
      { pkg: "com.samsung.android.lool", cls: "com.samsung.android.sm.battery.ui.BatteryActivity" },
      { pkg: "com.samsung.android.sm_cn", cls: "com.samsung.android.sm.ui.battery.BatteryActivity" },
    ],
  },
];

function vendorKey(): string {
  return `${Device.manufacturer ?? ""} ${Device.brand ?? ""}`.toLowerCase();
}

function pagesFor(): VendorPages | undefined {
  const key = vendorKey();
  return VENDORS.find((v) => v.match.test(key));
}

/** Vendor name for copy, e.g. "Xiaomi", "HUAWEI", "Samsung"; empty when unknown. */
export function vendorName(): string {
  const m = (Device.manufacturer ?? Device.brand ?? "").trim();
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : "";
}

/** Settings this phone needs. Autostart is listed only for vendors known to have that permission. */
export function keepAliveSteps(): KeepAliveStep[] {
  return pagesFor()?.autostart ? ["autostart", "battery"] : ["battery"];
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

const launch = (p: Page) => () =>
  IntentLauncher.startActivityAsync("android.intent.action.MAIN", { packageName: p.pkg, className: p.cls, extra: p.extra });

/** Try each launcher in order; the last resort is the app's own App info page. */
async function firstThatOpens(attempts: Array<() => Promise<unknown>>): Promise<void> {
  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch {
      // that page does not exist on this firmware; try the next one
    }
  }
  await Linking.openSettings();
}

/** The vendor's Autostart manager; App info when none of the known pages exist. */
export async function openAutostartSettings(): Promise<void> {
  const v = pagesFor();
  const pages = v?.autostart ?? [];
  await firstThatOpens([
    ...(pages.some((p) => p.pkg === "com.miui.securitycenter")
      ? [() => IntentLauncher.startActivityAsync("miui.intent.action.OP_AUTO_START")]
      : []),
    ...pages.map(launch),
    ...(v?.autostartAction ? [() => IntentLauncher.startActivityAsync(v.autostartAction as string)] : []),
  ]);
  await markAutostartConfirmed();
}

/**
 * The vendor's own per-app battery page when it has one, otherwise the system
 * "Allow app to run in background?" dialog, which sets Unrestricted in one tap.
 */
export async function openBatterySettings(): Promise<void> {
  const requestDialog = () =>
    IntentLauncher.startActivityAsync("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", { data: `package:${PKG}` });
  const vendorPages = (pagesFor()?.battery ?? []).map(launch);
  await firstThatOpens([...vendorPages, requestDialog]);
}
