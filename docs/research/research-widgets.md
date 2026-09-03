# Research: Emergency Health Card on the LOCK SCREEN / home screen from React Native (Expo) — feasibility as of 2026-09-03

Project: MediFirstCard (course 040333215 Smart Technology 2026). Dev machine: Windows 10, no Xcode. Android-first. Demo 7 Oct 2026, repo 11 Oct 2026. Zero budget.

Verification legend used below:
- [FETCHED-TODAY] = primary source fetched in this run (npm registry via curl, or WebFetch of official page).
- [DIGEST] = supported by a fetched result recorded in the previous agent's transcript digest.
- [UNVERIFIED] = inferred / not directly confirmed.

---

## 0. Baseline platform versions (all [FETCHED-TODAY] from https://registry.npmjs.org/ unless noted)

| Package | Latest | Published | Notes |
|---|---|---|---|
| expo | 57.0.19 | 2026-09-01 | SDK 57 released 2026-06-30 [DIGEST: https://expo.dev/changelog/sdk-57]. RN 0.86.3 bundled (scratchpad bundled57.json from previous agent's `expo` registry pull). SDK 58 canary exists (58.0.0-canary-20260902). |
| react-native-android-widget | 0.22.1 | 2026-08-17 | peerDeps: `expo >=54.0.0`, react *, react-native *. Repo https://github.com/sAleksovski/react-native-android-widget |
| expo-widgets | 57.0.16 | 2026-09-01 | iOS only. https://docs.expo.dev/versions/latest/sdk/widgets/ |
| expo-notifications | 57.0.16 | 2026-09-01 | bundled `~57.0.16` in SDK 57 |
| react-native-notify-kit | 10.7.0 | 2026-08-31 | Notifee-compatible maintained fork. peer expo *, RN >=0.73. https://github.com/marcocrupi/react-native-notify-kit |
| @notifee/react-native | 9.1.8 | 2024-12-20 | ARCHIVED 2026-04-07 [DIGEST: https://github.com/invertase/notifee] — do not adopt |
| @bacons/apple-targets | 5.0.0 | 2026-07-17 | peer `expo >=52`. https://github.com/evanbacon/expo-apple-targets |
| expo-live-activity (SWM) | 0.4.2 | 2025-11-18 | README says deprecated in favour of expo-widgets [DIGEST] |
| react-native-view-shot | 5.1.1 | 2026-06-20 | SDK 57 bundles 5.1.0; in Expo Go [DIGEST: https://docs.expo.dev/versions/latest/sdk/captureRef/] |
| react-native-nitro-wallpaper | 1.1.5 | 2026-01-24 | Android only; peer `react-native-nitro-modules ^0.33.0`; Expo config plugin |
| react-native-quick-settings-tile | 0.1.0 | 2026-08-07 | Expo SDK 54+ (developed against 57); Android QS tile + iOS 18 Control Center |
| react-native-android-quick-settings-tiles | 0.1.0 | 2022-12-28 | stale, avoid |
| react-native-nfc-manager | 3.17.2 | 2025-11-28 | Expo config plugin; 4.0.0-beta.7 exists |
| react-native-wallet-manager | 2.1.0 | 2026-03-03 | Apple Wallet + Google Wallet add-pass helper |
| @premieroctet/react-native-wallet | 1.0.2 | 2025-06-26 | older |

Other SDK 57 bundled versions relevant here (bundled57.json): expo-print ~57.0.1, expo-sharing ~57.0.17, expo-media-library ~57.0.4, expo-background-task ~57.0.15, expo-task-manager ~57.0.15, expo-secure-store ~57.0.3, expo-sqlite ~57.0.2, expo-intent-launcher ~57.0.1, expo-linking ~57.0.9, react-native-svg 15.15.4, @react-native-async-storage/async-storage 2.2.0, expo-dev-client ~57.0.18, expo-build-properties ~57.0.16.

EAS Build free plan [DIGEST: https://expo.dev/pricing]: "15 Android and 15 iOS builds" per month, "Low-priority queue", "45-minute build timeout". EAS Update free: 1K MAU.

Windows local Android build [DIGEST: https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=physical&mode=development-build&buildEnv=local]: OpenJDK 17 (`choco install -y microsoft-openjdk17`), Android Studio with "Android 16 (Baklava) SDK Platform 36", `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`, USB debugging, then `npx expo run:android`. This is the primary build path for every native option below; EAS cloud is the fallback (15 builds/month).

Apple Developer Program [FETCHED-TODAY: https://developer.apple.com/programs/whats-included/]: "The Apple Developer Program is 99 USD per membership year". EAS docs [DIGEST: https://docs.expo.dev/build/setup/]: "If you are going to use EAS Build to create release builds for the Apple App Store, you need access to an account with a $99 USD Apple Developer Program membership." Device builds (ad hoc) also need an Apple Developer account per https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/ (`eas device:create`) [DIGEST]. Zero budget => iOS is out unless a team member already has a paid account.

---

## 1. Android HOME-SCREEN widget: react-native-android-widget

Source pages (fetched in digest or today):
- Docs root: https://saleksovski.github.io/react-native-android-widget/ — states "Support for expo using custom config plugin" and "Supports the React Native new architecture" [DIGEST].
- Getting started: https://saleksovski.github.io/react-native-android-widget/docs — "React Native 0.76.0 and newer use react-native-android-widget 0.15.0+" [DIGEST].
- Expo registration: https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-widget-expo [DIGEST] — requires "Build an Expo Dev Client that will include react-native-android-widget and the new widget" (NOT Expo Go).
- Task handler: https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-task-handler [DIGEST].
- Update: https://saleksovski.github.io/react-native-android-widget/docs/update-widget [DIGEST].
- Clicks: https://saleksovski.github.io/react-native-android-widget/docs/handling-clicks [FETCHED-TODAY] (note: `/docs/handle-clicks` and `/docs/tutorial/handling-clicks` 404).
- Releases: https://github.com/sAleksovski/react-native-android-widget/releases [DIGEST]: 0.22.1 (Aug 17 2026) ListWidget overlay fix; 0.22.0 (Aug 8 2026) `requestPinWidget` shows the native "add widget" prompt; 0.21.0 (Jul 11 2026) lineHeight/lineSpacingExtra for TextWidget, resizeMode for ImageWidget, expedited WorkManager requests on Android 12+; 0.20.x May 2026.
- Repo stats [DIGEST]: 894 stars, MIT.

### Install / config (exact)
```
npx expo install react-native-android-widget
```
`app.config.ts` (from docs, quoted):
```ts
import type { ConfigContext, ExpoConfig } from 'expo/config';
import type { WithAndroidWidgetsParams } from 'react-native-android-widget';

const widgetConfig: WithAndroidWidgetsParams = {
  fonts: ['./assets/fonts/Inter.ttf'],
  widgets: [
    {
      name: 'EmergencyCard',            // must match the name used in the task handler
      label: 'MediFirstCard Emergency',
      minWidth: '320dp',
      minHeight: '120dp',
      targetCellWidth: 5,
      targetCellHeight: 2,
      description: 'Blood type, allergies, conditions, emergency contact',
      previewImage: './assets/widget-preview/emergency.png',
      updatePeriodMillis: 1800000,      // 30 min minimum
    },
  ],
};
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  plugins: [['react-native-android-widget', widgetConfig]],
});
```
Then `npx expo prebuild --platform android` (or let `npx expo run:android` prebuild) and build a dev client: `npx expo run:android` on Windows, or `eas build --platform android --profile development`.

### How the widget gets data the RN app wrote
- The widget is rendered by JS in a headless task. `registerWidgetTaskHandler(widgetTaskHandler)` is called in `index.js`/`index.ts` (Expo: create a custom entry file and point `"main"` at it). The handler receives `props.widgetAction` in {`WIDGET_ADDED`, `WIDGET_UPDATE`, `WIDGET_RESIZED`, `WIDGET_DELETED`, `WIDGET_CLICK`} and calls `props.renderWidget(<Widget .../>)` [DIGEST].
- The handler is `async`, so before `renderWidget` it can read from AsyncStorage / expo-sqlite / MMKV (same app sandbox, no App Group needed on Android). Pattern: app saves `emergencyCard` JSON + `lockScreenFields` (the user's privacy selection) to AsyncStorage on every edit, then calls `requestWidgetUpdate({ widgetName: 'EmergencyCard', renderWidget: () => <EmergencyWidget data={...}/>, widgetNotFound: () => {} })` [DIGEST: update-widget page — 3 update paths: updatePeriodMillis (>=30 min), requestWidgetUpdate from the app, native `RNWidgetJsCommunication#requestWidgetUpdate`].
- Widgets are drawn with `FlexWidget`, `TextWidget`, `ImageWidget`, `ListWidget` primitives (Flexbox -> RemoteViews); no custom native views (Android RemoteViews restriction: "You can't use custom views or subclasses of the views that are supported by RemoteViews" [DIGEST: https://developer.android.com/develop/ui/views/appwidgets]).
- `WidgetPreview` component renders the widget inside the app (useful for the in-app "preview your lock-screen card" screen and for demoing on any device) [DIGEST: sidebar page tutorial/widget-preview; page fetch was rate-limited, content unverified].

### Tap / deep-link
[FETCHED-TODAY handling-clicks]: any primitive accepts `clickAction` and `clickActionData`. Built-ins: `clickAction="OPEN_APP"` opens the app; `clickAction="OPEN_URI"` with `clickActionData={{ uri: 'medifirstcard://emergency' }}` opens a deep link ("Supports web URLs (https://google.com) and app deep links (androidwidgetexample://deep-link)"). "Click functionality requires Android 7+." Custom actions arrive in the task handler as `WIDGET_CLICK` with `props.clickAction`/`props.clickActionData`.

### Privacy (which fields appear)
Pure app logic: a `Settings > Lock-screen card` screen with toggles per field (blood type, allergies, conditions, medications, contact name/phone, name). Save `{ showBloodType: true, ... }`; the widget renderer only emits enabled fields; call `requestWidgetUpdate` after save. Also exposes `requestPinWidget()` (0.22.0) so the app can offer an "Add to home screen" button.

### Demo-ability
- Physical Android phone: yes (any Android 7+ launcher that supports widgets).
- Android Studio emulator: yes — the default Pixel launcher on AVD system images supports long-press > Widgets. [UNVERIFIED for the exact SDK 36 image, but standard behaviour; digest search results include tutorials that test on emulator.]
- Effort: 1–2 days for a static card widget incl. config plugin + dev build; +0.5 day for the field-selection settings screen.
- Risk: low-medium. New Architecture claimed supported; peer expo >=54 and SDK 57 (RN 0.86) — no issue found but no explicit SDK 57 compat statement (releases page mentions none). First build on Windows may need `expo-build-properties` tweaks; rebuild required after every widget config change.

---

## 2. Android LOCK SCREEN specifically

### 2a. Android 16 QPR2 lock-screen widgets (Pixel) — "hub mode"
- Android Developers Blog FAQ, 6 Mar 2025 [DIGEST: https://android-developers.googleblog.com/2025/03/widgets-on-lock-screen-faq.html]: "All widgets are compatible with the lock screen widget experience." Opt-out: "use the widget category 'not_keyguard' in your appwidget info xml file" in an "xml-36 resource folder". If a widget "launches an activity from the lock screen, users must authenticate to launch the activity, or the activity should declare android:showWhenLocked='true'". Rollout to AOSP "in the release after Android 16 (QPR1)".
- Android 16 QPR2 released 2 Dec 2025 [DIGEST: https://android-developers.googleblog.com/2025/12/android-16-qpr2-is-released.html]: "the first release to utilize a minor SDK version" (36.1); "If you don't have a Pixel device, you can use the 64-bit system images with the Android Emulator in Android Studio."
- Pixel UX [DIGEST: https://www.androidauthority.com/lock-screen-widgets-on-phones-android-16-qpr2-3589668/ (20 Aug 2025)]: Settings > Display & touch > "widgets on lock screen"; master toggle + "When to automatically show"; "swipe inward from the right edge of the lock screen"; "Each page can hold up to three widgets".
- [FETCHED-TODAY: https://9to5google.com/2025/08/20/android-qpr2-lock-screen-widgets/]: supports "proprietary and third-party widgets"; "Editing or tapping a widget through the new lock screen hub will require an unlocked device."; auto-show options: when charging / "upright and charging" / never.
- Implication: the SAME react-native-android-widget widget (no extra code) is eligible for the Pixel lock screen; nothing must be declared. Displaying is passive (no unlock); tapping requires unlock — acceptable, since the card is read-only. Do NOT add `not_keyguard`. Consider `android:showWhenLocked="true"` on MainActivity only if you want a tap to open a read-only emergency activity without unlock (extra native config via expo config plugin / AndroidManifest mod; [UNVERIFIED] whether RN MainActivity handles this cleanly).
- Devices: Pixel phones on Android 16 QPR2+ (Dec 2025 onward). Emulator: Android Studio AVD with a "Android 16 QPR2 / API 36.1" Google Play or Google APIs image — lock-screen widget hub availability on the emulator is [UNVERIFIED]; the blog says the QPR2 system images exist, so test early (day 1) and fall back to screen-recording a Pixel if needed.

### 2b. Samsung One UI 8 / 8.5
- As of the One UI 8 beta (May 2025) Samsung lock screen holds "up to four" widgets [FETCHED-TODAY: https://www.sammobile.com/news/samsung-one-ui-8-bigger-lock-screen-widgets/]; SamMobile/SammyFans reports (Mar 2025) say third-party lock-screen widgets were EXPECTED via AOSP but the Samsung support page for One UI 8 lists first-party widgets only (Camera, Device Care, Digital Wellbeing, Gallery, Interpreter, Modes and Routines) [search result summary: https://www.samsung.com/uk/support/mobile-devices/one-ui-8-widgets-on-your-samsung-galaxy-s25/ — page itself redirect-looped; UNVERIFIED]. Treat third-party lock-screen widgets on Galaxy as NOT available unless the team's own Galaxy phone shows otherwise.
- Other OEMs (Xiaomi/OPPO/vivo, common in Thailand): no evidence of third-party lock-screen widgets. [UNVERIFIED]

### 2c. Persistent ongoing notification with PUBLIC lock-screen visibility (broad-compatibility path, Android 8+)
This is the path that shows on essentially EVERY Android phone's lock screen (Pixel, Samsung, Xiaomi), and works on the emulator.
- expo-notifications (bundled, Expo Go-compatible for local notifications): "Local notifications (in-app notifications) remain available in Expo Go." [FETCHED-TODAY: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/]. `NotificationContentInput.sticky`: "If set to true, the notification cannot be dismissed by swipe... Corresponds directly do Android's isOngoing behavior." [DIGEST]. Channel field `lockscreenVisibility: AndroidNotificationVisibility` exists on `NotificationChannel`/`NotificationChannelInput` [FETCHED-TODAY + DIGEST]; the enum members are not spelled out in the doc text (source enum is `AndroidNotificationVisibility { UNKNOWN=0, PUBLIC=1, PRIVATE=2, SECRET=3 }` — [UNVERIFIED from docs; check `node_modules/expo-notifications/build/NotificationChannelManager.types.d.ts`]). `setNotificationChannelAsync(channelId: string, channel: NotificationChannelInput): Promise<NotificationChannel | null>`. Show immediately with `scheduleNotificationAsync({ content, trigger: null })`.
  ```ts
  import * as Notifications from 'expo-notifications';
  await Notifications.setNotificationChannelAsync('emergency-card', {
    name: 'Emergency Health Card',
    importance: Notifications.AndroidImportance.LOW,      // silent
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.scheduleNotificationAsync({
    identifier: 'emergency-card',
    content: {
      title: 'MediFirstCard - Emergency',
      body: 'Blood: O+ | Allergy: Penicillin | Contact: Mom 081-xxx-xxxx',
      sticky: true, autoDismiss: false,
      data: { url: 'medifirstcard://emergency' },
    },
    trigger: null,
  });
  ```
  Limitations: expo-notifications has no BigText/Inbox style control and no foreground-service API; body is a single line collapsed (expanded shows more on long-press/expand). Android 14 behaviour [DIGEST: https://developer.android.com/about/versions/14/behavior-changes-all]: ongoing notifications became user-dismissable, BUT "still non-dismissable in the following conditions: When the phone is locked; If the user selects a Clear all". So the card can be swiped away when unlocked — re-post it on app foreground and via `expo-background-task` (min 15-min interval) or on BOOT via a headless task ([UNVERIFIED] boot re-post in Expo without native code).
- react-native-notify-kit 10.7.0 (Notifee API-compatible; supports "foreground services, and Expo CNG development builds" per npm description) gives: `AndroidVisibility.PUBLIC`, `ongoing: true`, `AndroidStyle.BIGTEXT` / `INBOX` (multi-line card), `asForegroundService: true` (notification "cannot be removed by the user and lives for the duration of the service" [DIGEST Notifee foreground-service docs; Android 14+ needs `foregroundServiceType` in manifest]), action buttons (`pressAction`), `color`/`colorized`. Notifee docs remain the reference: https://notifee.app/react-native/docs/android/appearance , https://notifee.app/react-native/docs/android/styles , https://notifee.app/react-native/docs/android/foreground-service. Notifee itself is archived (7 Apr 2026) and recommends "expo-notifications or the community-maintained fork react-native-notify-kit" [DIGEST]. Requires dev build (not Expo Go). Media-style and custom RemoteViews layouts are NOT supported [DIGEST].
- Privacy: the notification text is composed from the same `lockScreenFields` selection; channel visibility PUBLIC only for the card channel. Add an in-app switch "Show card on lock screen" that cancels/re-posts.
- Effort: 0.5 day (expo-notifications) / 1 day (notify-kit with BigText + foreground service). Risk: low. Demo: phone + emulator (lock the emulator with the power button; notification shows on the AVD lock screen).

### 2d. Android built-in Emergency information (Personal Safety app)
[DIGEST: https://support.google.com/android/answer/9319337?hl=en]: Settings > Safety & emergency (Android 12+; Personal Safety app on Pixel; Samsung has its own "Emergency contacts / Medical info"). Responders: lock screen > swipe up > "Emergency" > "View emergency info". Stores blood type, allergies, medications, medical notes, emergency contacts ("Show when locked").
- No public third-party write API was found (searches returned only user how-tos) [UNVERIFIED negative]. The app can only (a) show a step-by-step "Also add this to your phone's Emergency information" guide and (b) try to open the settings screen with `expo-intent-launcher` (`IntentLauncher.startActivityAsync('android.settings.SETTINGS')` or OEM-specific actions — the exact emergency-info intent action is [UNVERIFIED]). Useful as a rubric "limitations & responsible use" talking point: OS-level Medical ID exists; MediFirstCard complements it.

### 2e. Quick Settings tile
react-native-quick-settings-tile 0.1.0 [FETCHED-TODAY README: https://github.com/probert100/react-native-quick-settings-tile]: "A Quick Settings tile (Android) and a Control Center control (iOS 18+) that open your app at a deep link of your choosing." Install `npx expo install react-native-quick-settings-tile && npx expo prebuild --clean`; requires dev build; "Expo SDK 54+ (developed against SDK 57)"; Android 7+. Config: `["react-native-quick-settings-tile", { "label": "Emergency card", "url": "medifirstcard://emergency" }]`; default `android.requireUnlock: true` (set false to allow opening from the lock-screen QS shade — [UNVERIFIED] whether the option exists as `requireUnlock: false`). Tile opens the deep link as ACTION_VIEW. Pairs with `android:showWhenLocked` on the emergency activity for a true no-unlock path. Effort 0.5 day. Very new package (single release 2026-08-07) => risk medium.

---

## 3. iOS (stretch only; needs 99 USD Apple Developer Program for any device install)

### 3a. expo-widgets (official, SDK 55 alpha -> stable in SDK 56; 57.0.16 now)
[DIGEST: https://docs.expo.dev/versions/latest/sdk/widgets/ and https://expo.dev/changelog/sdk-56]: "iOS only"; families `systemSmall/Medium/Large/ExtraLarge` and LOCK SCREEN `accessoryCircular`, `accessoryRectangular`, `accessoryInline`; Live Activities "display real-time information on the Lock Screen and in the Dynamic Island"; "not available in the Expo Go app — use development builds". Install `npx expo install expo-widgets`; config plugin with `widgets: [{ name, displayName, supportedFamilies: ['accessoryRectangular', ...] }]`, `groupIdentifier` (App Group) set automatically; widget written in JSX with `'widget'` directive using `@expo/ui/swift-ui` (`VStack`, `Text`); data via `MyWidget.updateSnapshot({...})` / `updateTimeline([...])`. Example `npx create-expo-app --example with-widgets` (README says Xcode needed for a local build; iOS 16+) [DIGEST: https://github.com/expo/examples/tree/master/with-widgets].
- Building without a Mac: EAS Build compiles iOS in the cloud; Expo has a dedicated "iOS App Extensions" page https://docs.expo.dev/build-reference/app-extensions/ [search hit; content UNVERIFIED]. Widget extension code is generated by the config plugin at prebuild, so EAS Build on Windows is feasible in principle [UNVERIFIED end-to-end]. Free tier: 15 iOS builds/month, low-priority queue.
- Apple lock-screen accessory widgets [DIGEST: https://developer.apple.com/documentation/widgetkit/creating-lock-screen-widgets-and-watch-complications]: iOS 16+, vibrant rendering, glanceable text/gauges, visible without unlocking.
- Effort: 2–3 days IF an iPhone + paid account exists; else 0 (document as future work). Risk: high for this team (no Mac, no budget).

### 3b. @bacons/apple-targets 5.0.0
[DIGEST: https://evanbacon-expo-apple-targets.mintlify.app/introduction]: config plugin generating 30+ Apple targets (widgets, Live Activities, App Clips...); `npx create-target widget`; each target has `targets/<name>/expo-target.config.js`; App Groups automatic; `ExtensionStorage` (`storage.set(...)`, `ExtensionStorage.reloadWidget()`) writes UserDefaults for the SwiftUI widget; requirements "CocoaPods 1.16.2+, Xcode 16+ (macOS Sequoia), Expo SDK 53+". You must hand-write SwiftUI — worse fit than expo-widgets for this team. Prefer expo-widgets.

### 3c. Live Activities
Supported inside expo-widgets (SDK 56+). software-mansion-labs/expo-live-activity 0.4.2 is deprecated in favour of expo-widgets [DIGEST]. Not relevant to a static emergency card; skip.

### 3d. Apple Medical ID
[DIGEST: https://support.apple.com/en-us/105072]: "To make your Medical ID available from the Lock screen on your iPhone, turn on Show When Locked." No third-party write API documented. Mention as OS-level equivalent in README.

---

## 4. Zero-native / low-native fallbacks (all work from Expo Go except where noted)

### 4a. Render card to image + set as LOCK-SCREEN WALLPAPER (Android)
- Render: `react-native-view-shot` (`captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' })`), in Expo Go [DIGEST]. Design the card as a full-screen 1080x2400 `View` with the selected fields large (elderly users) and blank space around the clock area.
- Set wallpaper (needs dev build):
  - react-native-nitro-wallpaper 1.1.5 [FETCHED-TODAY README]: `npm install react-native-nitro-wallpaper react-native-nitro-modules`; app.json plugin `"react-native-nitro-wallpaper"`; `npx expo prebuild`; API `WallpaperSet.setWallpaper(imageSource: string, screen?: 'home' | 'lock' | 'both')` (default 'both'); accepts file paths/URIs; "This library is Android-only. iOS is not supported." Peer `react-native-nitro-modules ^0.33.0` (Nitro requires New Architecture — fine on SDK 57).
  - @codeooze/react-native-wallpaper-manager (older, `applyWallpaper({ uri, screen: 'home'|'lock'|'both' })`, Android only) [DIGEST] — fallback if nitro fails on Windows build.
  - Underlying Android API: `WallpaperManager.setStream/setBitmap(..., FLAG_LOCK)`, permission `android.permission.SET_WALLPAPER` (normal permission) [reference page fetch truncated; UNVERIFIED quote].
  - Alternative with zero native code: save PNG to gallery with `expo-media-library` (`Asset.create(filePath, album)`; `saveToLibraryAsync` deprecated; in Expo Go) and instruct user to set it as lock-screen wallpaper manually (works on iOS too).
- Privacy: the image only contains the user's selected fields (same `lockScreenFields`). This is literally "information on the lock screen without unlocking" on 100% of Android phones including emulator. Effort: 1 day. Risk: low (nitro build on Windows [UNVERIFIED]; gallery-save fallback is guaranteed).

### 4b. QR code -> public emergency web page
- `react-native-qrcode-svg` + `react-native-svg` (bundled 15.15.4). QR encodes `https://<worker>.workers.dev/e/<opaque-token>`; token maps to only the user-approved public fields on the server (Express route or Cloudflare Worker: free "100,000 per day" requests, static assets free [DIGEST: https://developers.cloudflare.com/workers/platform/pricing/]).
- Put the QR on the wallpaper image / widget / notification big-picture / printed card. Responders scan with any phone. Effort: 1 day incl. backend route + minimal HTML page. Ties directly to the proposal's Node/Express REST API. Risk: low. Demo: emulator + presenter's phone scanning the laptop screen.

### 4c. Printable PDF card
`expo-print` `printToFileAsync({ html, width, height })` -> PDF; `expo-sharing.shareAsync(uri)`; both in Expo Go [DIGEST: https://docs.expo.dev/versions/latest/sdk/print/]. Wallet-size card with QR. Also counts for rubric Category 1 "Export data as CSV/JSON/PDF report". Effort 0.5 day.

### 4d. Google Wallet / Apple Wallet pass
- Google Wallet generic pass [DIGEST: https://developers.google.com/wallet/generic/getting-started/issuer-onboarding and .../add-to-google-wallet-flow]: issuer account via Google Pay & Wallet Console ("public business name" required); "all new accounts are in 'demo mode'. In demo mode, you can create passes, but you won't have publishing access"; demo passes "can only be issued to users who have the 'Admin' or 'Developer' role, or who have been added as a test account"; server signs JWT with a service account; link `https://pay.google.com/gp/v/save/{signed_jwt}` — no app change needed. Cost: no fee stated (free per Google's public positioning; [UNVERIFIED]). Demo mode is enough for a class demo (add teammates as test accounts).
- Apple Wallet: needs Pass Type ID certificate from a paid developer account -> out of budget.
- Lock-screen relevance: Wallet passes are NOT on the lock screen without user action; weak fit. Effort 1–2 days (server JWT). Risk medium (console approval for business name).

### 4e. NFC tag
react-native-nfc-manager 3.17.2 (config plugin `"react-native-nfc-manager"`, minSdk 31 enforced, not Expo Go, needs physical NFC phone; no emulator) [DIGEST: https://github.com/revtel/react-native-nfc-manager/wiki/Expo-Go]. Write the emergency URL as an NDEF URI to a cheap NTAG213 sticker on the phone case; any phone taps it. Effort 0.5–1 day. Rubric: Category 3 "Sensor/IoT" flavour. Risk: hardware availability.

---

## 5. Comparison matrix

| # | Option | Shows on LOCK screen w/o unlock? | Devices | Windows dev | Expo Go? | Emulator demo | Effort (days) | Risk |
|---|---|---|---|---|---|---|---|---|
| 1 | Android home-screen widget (react-native-android-widget 0.22.1) | Home screen only, except Pixel A16 QPR2+ where the same widget goes on the lock-screen hub | Android 7+ | yes (dev build) | no | yes | 1.5–2.5 | low-med |
| 2 | Pixel Android 16 QPR2 lock-screen widget (= option 1, no extra code) | YES (read-only; tap needs unlock) | Pixel on A16 QPR2+ (Dec 2025+); Samsung/others unconfirmed | yes | no | maybe (QPR2 image) | +0.5 | med (device availability) |
| 3 | Sticky PUBLIC notification (expo-notifications) | YES on all Android 8+ lock screens (collapsed 1–2 lines) | all Android | yes | YES | yes | 0.5 | low |
| 4 | Foreground-service BigText notification (react-native-notify-kit 10.7.0) | YES, non-dismissable, multi-line | all Android | yes (dev build) | no | yes | 1 | low-med |
| 5 | Card image -> lock-screen wallpaper (view-shot + nitro-wallpaper) | YES on all Android; iOS via manual set | all | yes (dev build); gallery-save path is Expo Go | partial | yes | 1 | low |
| 6 | QR -> public emergency page (Express/Cloudflare) | Indirect (QR must be visible via 1/3/5 or print) | all | yes | YES | yes | 1 | low |
| 7 | Quick Settings tile (react-native-quick-settings-tile 0.1.0) | Tile visible in shade on lock screen; opening needs unlock unless requireUnlock=false + showWhenLocked | Android 7+ | yes (dev build) | no | yes | 0.5 | med (new lib) |
| 8 | iOS WidgetKit accessory widget (expo-widgets 57.0.16 via EAS) | YES on iOS 16+ | iPhone | cloud only | no | no | 2–3 + 99 USD | high |
| 9 | Printable PDF card (expo-print) | n/a (physical) | all | yes | YES | yes | 0.5 | none |
| 10 | Google Wallet generic pass (demo mode) | no (Wallet app) | Android | yes | YES (web link) | yes | 1–2 | med |
| 11 | NFC NDEF tag (react-native-nfc-manager) | n/a (physical tag) | NFC phones | yes (dev build) | no | no | 0.5–1 | med |
| 12 | Guide to OS Emergency Info / Medical ID | YES (OS feature) but not our app's UI | all | yes | YES | yes | 0.25 | none |

---

## 6. Recommendation ladder

### GUARANTEED (do first, week 1)
1. **Sticky public-visibility notification card** — expo-notifications ~57.0.16 (already in SDK; local notifications work in Expo Go). Channel `lockscreenVisibility: PUBLIC`, `sticky: true`, `importance: LOW`, body built from the user's `lockScreenFields`. Re-post on app start and on every card edit. Demo: lock the emulator/phone -> card text is readable. Include "Show on lock screen" master switch (privacy contingency).
2. **Card-as-wallpaper** — react-native-view-shot 5.1.x renders the "Lock Screen Card" screen; save to gallery via expo-media-library (`Asset.create`) and show the instructions for "Set as lock screen wallpaper"; add react-native-nitro-wallpaper 1.1.5 (`setWallpaper(uri, 'lock')`) once the dev build works. Elderly-friendly big fonts.
3. **QR + public emergency page + PDF** — react-native-qrcode-svg; Express route `GET /public/emergency/:token` returning only consented fields; expo-print PDF card with QR (rubric: export + REST API integration).

### LIKELY (week 2)
4. **Android home-screen widget** — react-native-android-widget 0.22.1 with Expo config plugin; `registerWidgetTaskHandler` reads AsyncStorage/expo-sqlite; `requestWidgetUpdate` after edits; `OPEN_URI` -> `medifirstcard://emergency`; `requestPinWidget` button; `WidgetPreview` for in-app preview. This is the proposal's literal "Android App Widget API" commitment.
5. **Foreground-service / BigText notification** via react-native-notify-kit 10.7.0 (Notifee API) if the plain notification is too short: `AndroidStyle.BIGTEXT`, `ongoing: true`, `asForegroundService: true`, `visibility: AndroidVisibility.PUBLIC`.

### STRETCH
6. **Pixel Android 16 QPR2 lock-screen widget** — no code beyond #4; test on an Android 16 QPR2 AVD image (API 36.1) or a Pixel; record a video. Do not declare `not_keyguard`.
7. **Quick Settings tile** — react-native-quick-settings-tile 0.1.0 deep-linking to the emergency screen.
8. **iOS accessory widget** — expo-widgets 57.0.16 (`supportedFamilies: ['accessoryRectangular','accessoryInline','systemSmall']`), built via `eas build --platform ios` only if a teammate has an iPhone AND a paid Apple Developer account. Otherwise document as future work with the proposal's WidgetKit mention satisfied by design/README.

### Privacy field selection (all options)
Single source of truth: `lockScreenFields: { name, bloodType, allergies, conditions, medications, contact }` booleans stored locally (AsyncStorage / expo-sqlite) and mirrored to the backend `users.lock_screen_fields` JSONB. Every renderer (notification body, widget JSX, wallpaper view, QR public endpoint, PDF) consumes this object. A consent screen (rubric Category 5) explains that anything shown on the lock screen is visible to anyone holding the phone.

---

## 7. Risks
- Rubric requires the RN app to "actually run" live: keep Expo Go-compatible options (#1–3) working independently of the dev-build features.
- react-native-android-widget has no explicit Expo SDK 57 / RN 0.86 statement; build early (day 1 of week 2) and fall back to notification+wallpaper if the Gradle build fails.
- Android 14+ lets users swipe away ongoing notifications when unlocked; use foreground service (notify-kit) or re-post logic.
- Samsung/Xiaomi lock screens: third-party widgets not confirmed -> the widget is home-screen only there; the notification/wallpaper paths cover them.
- react-native-nitro-wallpaper and react-native-quick-settings-tile are young (<= 1.x, single maintainer).
- iOS: zero budget + no Mac -> unrealistic before 7 Oct; do not promise it in the demo.
- EAS free tier: 15 Android builds/month — build locally on Windows to avoid exhausting it.
- Health data on lock screen is sensitive; document consent and opt-in defaults (all fields OFF by default except emergency contact and blood type, user chooses).

## 8. Gaps not closed
- Exact `AndroidNotificationVisibility` enum member names in expo-notifications docs (verify in node_modules).
- Whether Android Studio's API 36.1 (Android 16 QPR2) emulator image exposes the lock-screen widget hub.
- Whether Samsung One UI 8/8.5 shipped third-party lock-screen widgets (support page could not be fetched).
- react-native-android-widget explicit compatibility note for Expo SDK 57 / RN 0.86 (only peer `expo >=54`).
- End-to-end proof that expo-widgets iOS extension builds on EAS from a Windows machine.
- Android intent action to open the OEM "Emergency information" settings screen from a third-party app.
- `requireUnlock:false` semantics and lock-screen behaviour of react-native-quick-settings-tile.
- Google Wallet API pricing statement (believed free; not quoted).
- WallpaperManager FLAG_LOCK exact API level (page truncated).
