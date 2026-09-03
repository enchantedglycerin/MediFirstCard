# Research: The correct React Native / Expo stack for MediFirstCard (as of 2026-09-03)

Sources: previous agent's digest (~100 fetches of Expo docs/changelog/npm) plus this run's direct npm-registry queries (`curl https://registry.npmjs.org/<pkg>`, 2026-09-03), the SDK 57 `bundledNativeModules.json` from GitHub, GitHub API repo metadata, and 12 WebFetches of primary docs. Every version marked "npm" below was read from the registry today.

## 1. Platform baseline

| Item | Value | Evidence |
|---|---|---|
| Latest stable Expo SDK | **SDK 57** (released 2026-06-30); `expo@57.0.19` published 2026-09-01 | https://expo.dev/changelog/sdk-57 ; https://registry.npmjs.org/expo |
| React Native | **0.86.3** (pinned in SDK 57 bundledNativeModules); `expo@57.0.17` moved to 0.86.3 to fix the Hermes V1 memory regression from SDK 56 | https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json ; https://expo.dev/changelog/sdk-57 |
| React | 19.2.3 | same bundledNativeModules |
| Upstream RN latest | 0.87.1 (2026-08-26) - NOT used by any Expo SDK yet; never install manually | https://github.com/facebook/react-native/releases |
| New Architecture | Mandatory. SDK 55 changelog: "you will not be able to use the Legacy Architecture in SDK 55 projects and later." Every library must be New-Arch compatible. | https://expo.dev/changelog/sdk-55 |
| JS engine | Hermes V1 default since SDK 56 (opt-out `useHermesV1`) | https://expo.dev/changelog/sdk-56 |
| Node | ^20.19.4, ^22.13.0, ^24.3.0, ^25 (SDK 55 changelog); SDK 56 lists Node 20.19.4+ | https://expo.dev/changelog/sdk-55 |
| SDK 58 | No beta announced as of 2026-09-03. Cadence is roughly quarterly (55: Feb 25, 56: May 21, 57: Jun 30), so a 58 beta could appear during the project. PIN SDK 57; do not upgrade before 11 Oct. | https://expo.dev/changelog |
| Expo Router | Versioned with the SDK: `expo-router@57.0.18` (npm 2026-09-01). Since SDK 56 it is FORKED from React Navigation: "In SDK 56 and later, Expo Router no longer supports importing from external @react-navigation/* packages in application code." Import from `expo-router/react-navigation`, `expo-router/js-tabs`, `expo-router/js-stack`; use `Stack`/`Drawer` layouts. Codemod: `npx expo-codemod sdk-56-expo-router-react-navigation-replace src` | https://docs.expo.dev/versions/latest/sdk/router/ ; https://docs.expo.dev/router/migrate/sdk-55-to-56/ |
| Expo Go | "first and foremost an educational tool". Store versions lag: SDK 54 was on the stores in May 2026; SDK 56 Go "not available on the Apple App Store or Google Play Store" at release; SDK 57 changelog: "still waiting on approval". On Android you can install Expo Go for any SDK via Expo CLI or https://expo.dev/go (direct APK). Since SDK 56 create-expo-app prompts whether to target the store version of Expo Go or the latest SDK. | https://expo.dev/changelog/expo-go-and-app-store-may-2026 ; https://expo.dev/changelog/sdk-56 ; https://expo.dev/changelog/sdk-57 |

Implication for MediFirstCard: use a **development build (expo-dev-client)** from day 1. The Android widget, react-native-mmkv, SQLCipher, any document scanner, and the expo-font config plugin all require a dev build; Expo Go availability for SDK 57 on stores is unreliable.

## 2. SDK 57 pinned native module versions (bundledNativeModules.json, sdk-57 branch, fetched 2026-09-03)

react-native 0.86.3; react 19.2.3; react-native-reanimated 4.5.1; react-native-gesture-handler ~2.32.0; react-native-screens ~4.26.0; react-native-safe-area-context ~5.7.0; react-native-svg 15.15.4; @react-native-async-storage/async-storage 2.2.0; react-native-worklets 0.10.1; react-native-webview 13.16.1; @shopify/react-native-skia 2.6.2; react-native-view-shot 5.1.0; @react-native-community/netinfo 12.0.1; react-native-pager-view 8.0.2; @react-native-community/datetimepicker 9.1.0; @expo/vector-icons ^15.0.2; expo-router ~57.0.18; jest-expo ~57.0.5; expo-sqlite ~57.0.2; expo-camera ~57.0.4; expo-notifications ~57.0.16; expo-secure-store ~57.0.3; expo-local-authentication ~57.0.2; expo-image-picker ~57.0.15; expo-image-manipulator ~57.0.15; expo-print ~57.0.1; expo-sharing ~57.0.17; expo-file-system ~57.0.6; expo-localization ~57.0.1; expo-font ~57.0.3; expo-dev-client ~57.0.18; expo-updates ~57.0.21; expo-widgets ~57.0.16; expo-linear-gradient ~57.0.1; expo-document-picker ~57.0.1; expo-network ~57.0.1; @expo/ui ~57.0.15; expo-image ~57.0.4; expo-splash-screen ~57.0.8; expo-symbols ~57.0.2. Not pinned: react-native-mmkv, @testing-library/react-native, @react-native-vector-icons/*.

**Rule: always install with `npx expo install <pkg>` so these pins are respected.** Breaking pairings found on npm today:
- `react-native-reanimated@4.6.0` (latest, 2026-08-21) peers `react-native-worklets 0.12.x` and RN 0.83-0.87, while SDK 57 ships reanimated 4.5.1 + worklets 0.10.1. Plain `npm i react-native-reanimated` breaks the build. Use `npx expo install react-native-reanimated`.
- `react-native-gesture-handler@3.2.1` (latest, 2026-08-14) vs SDK 57 pin ~2.32.0. Do not install v3.
- `@shopify/react-native-skia@2.11.2` latest (peers reanimated >=4, worklets >=0.7) vs SDK 57 pin 2.6.2; victory-native@42.0.1 peers skia >=2.6.0 <3.0.0 so the pinned 2.6.2 works.
- `@react-native-async-storage/async-storage@3.1.1` latest vs SDK pin 2.2.0 (prefer `expo-sqlite/kv-store`).
- `@react-navigation/native@7.3.18` / native-stack 7.18.10 (2026-08-26; 8.0.0-alpha exists) must NOT be imported in app code on SDK 56+.
- `jest-expo@57.0.5` peers `@react-native/jest-preset ^0.86.3`; `@testing-library/react-native@14.0.1` peers react >=19, RN >=0.78 and `test-renderer ^1.0.0` (install it if jest complains).

## 3. Package table (all "Latest/Published" values read from registry.npmjs.org on 2026-09-03)

| Concern | Package | Latest | Published | Expo Go? | Notes / link |
|---|---|---|---|---|---|
| Navigation | expo-router | 57.0.18 | 2026-09-01 | yes | file-based; default template already wires the entry; manual: `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar`, `"main": "expo-router/entry"`, `"scheme"`, `"experiments": {"typedRoutes": true}`; https://docs.expo.dev/router/installation/ |
| Server state | @tanstack/react-query | 5.102.8 | 2026-08-27 | yes | peers react ^18 or ^19. RN guide: onlineManager with expo-network/netinfo, focusManager via AppState, `subscribed` prop for unfocused screens; https://tanstack.com/query/latest/docs/framework/react/react-native |
| Client state | zustand | 5.0.15 | 2026-08-13 | yes | https://www.npmjs.com/package/zustand |
| Forms | react-hook-form | 7.87.0 | 2026-08-30 | yes | v8 is alpha/beta only; stay on 7.x |
| Validation | zod | 4.5.4 | 2026-08-29 | yes | https://www.npmjs.com/package/zod |
| Resolver | @hookform/resolvers | 5.9.1 | 2026-08-17 | yes | peer zod ^3.25.0 or ^4.0.0; `import { zodResolver } from '@hookform/resolvers/zod'`; https://github.com/react-hook-form/resolvers |
| Local DB | expo-sqlite | 57.0.2 | 2026-08-26 | yes (SQLCipher: no) | plugin `["expo-sqlite",{"useSQLCipher":true}]` then `PRAGMA key = '...'`; `expo-sqlite/kv-store` is an AsyncStorage drop-in (sync + async); https://docs.expo.dev/versions/latest/sdk/sqlite/ |
| ORM | drizzle-orm / drizzle-kit | 0.45.2 / 0.31.10 | 2026-03-27 / 2026-03-17 | yes | peer expo-sqlite >=14; babel-plugin-inline-import 3.0.0 (2018, stable and still the documented way); https://orm.drizzle.team/docs/connect-expo-sqlite |
| Alt DB | @op-engineering/op-sqlite | 18.1.4 | 2026-08-21 | no | faster JSI DB; needs dev build; not required for this app |
| KV cache | react-native-mmkv | 4.3.2 | 2026-06-22 | no | Nitro Module; needs react-native-nitro-modules 0.37.1 (2026-08-27); `npx expo install react-native-mmkv react-native-nitro-modules`; optional -- expo-sqlite/kv-store covers the need without extra native deps; https://github.com/mrousavy/react-native-mmkv |
| Secure storage | expo-secure-store | 57.0.3 | 2026-09-01 | yes (requireAuthentication: no) | Android Keystore-encrypted SharedPreferences, excluded from backup; values above ~2048 bytes may be rejected -> store only the PIN hash / DB key / auth token; https://docs.expo.dev/versions/latest/sdk/securestore/ |
| PIN / biometrics | expo-local-authentication | 57.0.2 | 2026-07-22 | yes (iOS FaceID: no) | `hasHardwareAsync`, `isEnrolledAsync`, `authenticateAsync({promptMessage, cancelLabel, disableDeviceFallback, biometricsSecurityLevel:'strong'})`; https://docs.expo.dev/versions/latest/sdk/local-authentication/ |
| Camera + QR scan | expo-camera | 57.0.4 | 2026-08-20 | yes | `<CameraView barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={...}/>`; `takePictureAsync({quality, base64, exif})`; plugin `barcodeScannerEnabled: true`; expo-barcode-scanner is gone -- do not use; https://docs.expo.dev/versions/latest/sdk/camera/ |
| Photo / gallery | expo-image-picker | 57.0.15 | 2026-09-01 | yes | `mediaTypes: ['images']` (MediaTypeOptions deprecated), `quality`, `allowsEditing`; result `assets[0].uri/width/height/fileSize/mimeType`; https://docs.expo.dev/versions/latest/sdk/imagepicker/ |
| Compress / rotate | expo-image-manipulator | 57.0.15 | 2026-09-01 | yes | `useImageManipulator(uri)` -> `.resize({width:1600})` -> `renderAsync()` -> `saveAsync({format:SaveFormat.JPEG, compress:0.7})`; `manipulateAsync` deprecated; https://docs.expo.dev/versions/latest/sdk/imagemanipulator/ |
| Document scanner (edge detect) | react-native-document-scanner-plugin | 2.0.4 | 2026-01-02 | no | Open issue #175 "Error when build with expo sdk 55" (2026-05-04) and #177 iOS crash (2026-05-29); repo last push 2026-01-02, 49 open issues. RISKY on SDK 57. https://github.com/WebsiteBeaver/react-native-document-scanner-plugin |
| Doc scanner alt | @dariyd/react-native-document-scanner | 2.0.19 | 2026-04-02 | no | peers RN >=0.77.3; ML Kit (Android) / VisionKit (iOS); last push 2026-04-02; https://github.com/dariyd/react-native-document-scanner |
| Doc scanner alt | @infinitered/react-native-mlkit-document-scanner | 5.0.0 | 2025-11-17 | no | Expo module (peer expo *), Android ML Kit Document Scanner; monorepo pushed 2026-08-05, not archived; https://docs.infinite.red/react-native-mlkit/document-scanner/ |
| PDF | expo-print | 57.0.1 | 2026-07-15 | yes | `printToFileAsync({html, base64?})` returns `{uri, numberOfPages}`; margins iOS-only; use base64 images in HTML; https://docs.expo.dev/versions/latest/sdk/print/ |
| Share | expo-sharing | 57.0.17 | 2026-09-01 | yes | `shareAsync(uri, {mimeType:'application/pdf', UTI:'.pdf'})`; https://docs.expo.dev/versions/latest/sdk/sharing/ |
| View -> image | react-native-view-shot | 5.1.1 | 2026-06-20 | yes (SDK pins 5.1.0) | peer RN >=0.76; `captureRef(ref, {format:'png', quality:1})`; https://www.npmjs.com/package/react-native-view-shot |
| QR generate | react-native-qrcode-svg + react-native-svg | 6.3.22 / 15.15.5 | 2026-09-02 / 2026-05-11 | yes | SDK pins svg 15.15.4; qrcode-svg peers svg >=14; https://www.npmjs.com/package/react-native-qrcode-svg |
| Notifications | expo-notifications | 57.0.16 | 2026-09-01 | local: yes; push: not in Android Expo Go since SDK 53 | Android channels mandatory (`setNotificationChannelAsync`), Android 13+ runtime permission; `sticky: true` and channel `lockscreenVisibility` (PUBLIC) supported; https://docs.expo.dev/versions/latest/sdk/notifications/ |
| Notifee | @notifee/react-native | 9.1.8 | 2024-12-20 | no | GitHub repo ARCHIVED 2026-04-07 (GitHub API `archived: true`); maintainers recommend expo-notifications. DO NOT USE. https://github.com/invertase/notifee |
| i18n | i18next / react-i18next | 26.4.1 / 17.0.13 | 2026-09-01 / 2026-09-01 | yes | react-i18next peers i18next >=26.2.0; https://react.i18next.com/ |
| Locale detect | expo-localization | 57.0.1 | 2026-07-15 | yes | `getLocales()[0].languageCode`, `useLocales()`; plugin `"expo-localization"`; Expo's guide shows i18n-js but react-i18next is listed as "stable, well-maintained"; https://docs.expo.dev/guides/localization/ |
| Fonts | @expo-google-fonts/sarabun 0.4.1; /noto-sans-thai 0.4.2; /inter 0.4.2 | | 2025-09-12 / 2025-09-05 / 2025-09-11 | useFonts: yes; expo-font plugin: no | `npx expo install @expo-google-fonts/sarabun expo-font expo-splash-screen`; https://docs.expo.dev/develop/user-interface/fonts/ |
| File system | expo-file-system | 57.0.6 | 2026-08-26 | yes | class API `File, Directory, Paths` (`new File(Paths.document,'x.jpg')`, `file.copy(dest)`, `await file.base64()`); legacy via `expo-file-system/legacy`; SDK 56 made `copy()/move()` async (use `copySync`); https://docs.expo.dev/versions/latest/sdk/filesystem/ |
| Charts (simple) | react-native-gifted-charts | 1.4.78 | 2026-08-10 | yes | `npx expo install react-native-gifted-charts expo-linear-gradient react-native-svg`; Line/Bar/Pie/Area; https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts |
| Charts (Skia) | victory-native | 42.0.1 | 2026-08-31 | yes (Skia is in Go) | peers skia >=2.6 <3, reanimated >=3.19.1, gesture-handler >=2 (all satisfied by SDK 57 pins); `CartesianChart` + `Line`; https://nearform.com/open-source/victory-native/docs/getting-started |
| Dates | dayjs | 1.11.23 | 2026-08-17 | yes | `import buddhistEra from 'dayjs/plugin/buddhistEra'; import 'dayjs/locale/th'; dayjs.extend(buddhistEra); dayjs().locale('th').format('D MMMM BBBB')`; https://day.js.org/docs/en/plugin/buddhist-era |
| Unit tests | jest-expo 57.0.5; @testing-library/react-native 14.0.1 | | 2026-08-26 / 2026-06-23 | | `npx expo install jest-expo jest @types/jest --dev; npx expo install @testing-library/react-native --dev`; react-test-renderer deprecated (no React 19); https://docs.expo.dev/develop/unit-testing/ |
| E2E | Maestro CLI cli-2.10.0 | | 2026-08-31 | | Native Windows: download maestro.zip from GitHub releases, extract to `C:\maestro`, `setx PATH "%PATH%;C:\maestro\bin"`; Java 17+ with JAVA_HOME; Android API 29-34 target devices; WSL discouraged ("requires advanced port configuration"); https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli ; https://github.com/mobile-dev-inc/maestro/releases |
| Android widget | react-native-android-widget | 0.22.1 | 2026-08-17 | no | peer expo >=54; Expo config plugin; v0.22.0 added `requestPinWidget`; v0.21.0 expedited WorkManager updates on Android 12+; https://github.com/sAleksovski/react-native-android-widget/releases ; tutorial https://github.com/sAleksovski/react-native-android-widget/blob/master/docs/docs/tutorial/register-widget-expo.md |
| iOS widget | expo-widgets | 57.0.16 | 2026-09-01 | no | iOS only; WidgetKit families incl. accessoryRectangular/accessoryCircular/accessoryInline (lock screen); data via App Groups; stable since SDK 56; https://docs.expo.dev/versions/latest/sdk/widgets/ |
| OTA | expo-updates | 57.0.21 | 2026-09-01 | n/a | `eas update:configure` adds `updates.url` + `runtimeVersion`; `eas update --channel preview --message "..."`; dev builds load updates via Extensions tab; https://docs.expo.dev/eas-update/getting-started/ |
| Dev client | expo-dev-client | 57.0.18 | 2026-09-01 | n/a | https://docs.expo.dev/develop/development-builds/create-a-build/ |
| CLI | eas-cli 23.2.0; create-expo-app 4.0.0 | | 2026-08-31 / 2026-05-15 | | |
| OCR (future) | @react-native-ml-kit/text-recognition | 2.0.0 | 2025-09-01 | no | ML Kit Text Recognition v2 supports Latin, Chinese, Devanagari, Japanese, Korean, Cyrillic -- Thai is NOT listed; https://developers.google.com/ml-kit/vision/text-recognition/v2/languages |
| Icons | @expo/vector-icons 15.0.2 (deprecated in SDK 56) -> @react-native-vector-icons/material-design-icons 13.1.3 (2026-08-20) | | | | https://expo.dev/changelog/sdk-56 |
| Network state | expo-network 57.0.1 / @react-native-community/netinfo 12.0.1 | | 2026-07-15 / 2026-02-14 | yes | for TanStack onlineManager |

## 4. Exact commands

```powershell
# Prereqs (Windows 10) - https://docs.expo.dev/workflow/android-studio-emulator/
choco install -y microsoft-openjdk17
# Android Studio: SDK Platform 36 (Android 16), Build-Tools, Emulator, Platform-Tools
# User env vars: ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk ; PATH += %LOCALAPPDATA%\Android\Sdk\platform-tools
adb --version

# Create project pinned to SDK 57 (default template = Expo Router + TypeScript)
npx create-expo-app@latest mfc --template default@sdk-57
# keep the path SHORT, e.g. C:\mfc (Windows 260-char limit; react-native-screens #3471)

# Core installs (npx expo install applies SDK-compatible pins)
npx expo install expo-dev-client expo-sqlite expo-secure-store expo-local-authentication expo-camera expo-image-picker expo-image-manipulator expo-print expo-sharing expo-file-system expo-notifications expo-localization expo-font expo-splash-screen expo-linear-gradient expo-network react-native-svg react-native-view-shot react-native-reanimated react-native-gesture-handler
npx expo install react-native-qrcode-svg react-native-gifted-charts react-native-android-widget
npx expo install @expo-google-fonts/sarabun @expo-google-fonts/inter
npm i @tanstack/react-query zustand react-hook-form zod @hookform/resolvers i18next react-i18next dayjs drizzle-orm
npm i -D drizzle-kit babel-plugin-inline-import
npx expo install jest-expo jest @types/jest @testing-library/react-native --dev

# Run on a physical Android phone (USB debugging on; `adb devices` shows "device")
npx expo run:android          # local Gradle build -> installs dev build -> starts Metro
npx expo start                # later launches; targets the dev build because expo-dev-client is installed
adb reverse tcp:8081 tcp:8081 # if phone is not on the same Wi-Fi (or: npx expo start --tunnel)

# Cloud alternative (Free: 15 Android + 15 iOS builds/month, 1 concurrency, low-priority queue, 45-min timeout)
npm i -g eas-cli; eas login; eas build:configure
eas build --platform android --profile development
# `eas build --local` on Windows: "No first-class support, but possible with WSL"
```

app.json plugin block:
```json
{
  "expo": {
    "scheme": "medifirstcard",
    "experiments": { "typedRoutes": true },
    "plugins": [
      "expo-router",
      "expo-localization",
      ["expo-sqlite", { "useSQLCipher": true }],
      ["expo-camera", { "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera", "barcodeScannerEnabled": true }],
      ["expo-image-picker", { "photosPermission": "Allow $(PRODUCT_NAME) to access your photos", "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera" }],
      ["expo-local-authentication", { "faceIDPermission": "Allow $(PRODUCT_NAME) to use Face ID." }],
      ["expo-secure-store", { "faceIDPermission": "Allow $(PRODUCT_NAME) to access your Face ID biometric data." }],
      ["expo-notifications", { "icon": "./assets/notification_icon.png", "color": "#ffffff", "defaultChannel": "default" }],
      ["expo-font", { "fonts": ["node_modules/@expo-google-fonts/sarabun/400Regular/Sarabun_400Regular.ttf"] }],
      ["react-native-android-widget", { "widgets": [{ "name": "EmergencyCard", "label": "MediFirstCard Emergency", "minWidth": "320dp", "minHeight": "120dp", "targetCellWidth": 5, "targetCellHeight": 2, "description": "Emergency health info", "previewImage": "./assets/widget-preview/emergency.png", "updatePeriodMillis": 1800000 }] }]
    ]
  }
}
```

react-native-android-widget entry wiring with Expo Router: create `index.ts` with `import 'expo-router/entry'; import { registerWidgetTaskHandler } from 'react-native-android-widget'; import { widgetTaskHandler } from './widget-task-handler'; registerWidgetTaskHandler(widgetTaskHandler);` and set `"main": "index.ts"` in package.json. The task handler switches on `WIDGET_ADDED | WIDGET_UPDATE | WIDGET_RESIZED | WIDGET_DELETED | WIDGET_CLICK` and calls `props.renderWidget(<EmergencyWidget .../>)`; primitives are `FlexWidget`, `TextWidget`, `ImageWidget`, `ListWidget`; `requestWidgetUpdate` refreshes from the app after data changes.

Drizzle: babel.config.js `plugins: [["inline-import", {"extensions": [".sql"]}]]` with preset `babel-preset-expo`; metro.config.js `config.resolver.sourceExts.push('sql')`; drizzle.config.ts `defineConfig({ schema:'./db/schema.ts', out:'./drizzle', dialect:'sqlite', driver:'expo' })`; `npx drizzle-kit generate`; `const db = drizzle(openDatabaseSync('mfc.db', { enableChangeListener: true }))`; `useMigrations(db, migrations)` from `drizzle-orm/expo-sqlite/migrator`; `useLiveQuery` for reactive lists.

Jest config (package.json): `"jest": { "preset": "jest-expo", "transformIgnorePatterns": ["node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"] }`; script `"test": "jest"`.

Default eas.json from `eas build:configure` (https://docs.expo.dev/build/eas-json/): `{"build":{"development":{"developmentClient":true,"distribution":"internal"},"preview":{"distribution":"internal"},"production":{}}}`; add `"android": {"buildType": "apk"}` to development and preview so the output is a sideloadable APK for the demo phone.

EAS Free plan (https://expo.dev/pricing): $0/month; 15 Android + 15 iOS builds/month; 45-minute timeout; 1 concurrency; low-priority queue; EAS Update 1K MAU, 100 GiB bandwidth, 20 GiB storage; 60 CI/CD Workflow minutes; EAS Submit included. Next tier Starter $19/month.

## 5. Windows gotchas
- Long paths: react-native-screens issue #3471 "Filename longer than 260 characters" from Ninja/CMake on RN 0.81+ / NDK 27. Keep the project at `C:\mfc`, enable `LongPathsEnabled` in the registry, no spaces or OneDrive folders in the path. https://github.com/software-mansion/react-native-screens/issues/3471
- Gradle daemon OOM: set `org.gradle.jvmargs=-Xmx4096m` in `android/gradle.properties` after prebuild (community fix; https://dev.to/asta_dev/how-to-fix-gradle-build-daemon-disappeared-unexpectedly-in-react-native-expo-m3d).
- `eas build --local` has no first-class Windows support (WSL only); use `npx expo run:android` or cloud EAS.
- Maestro: use the native Windows zip, not WSL.
- Emulator: Android Studio Device Manager AVD with Google Play image, then `npx expo start --android`.

## 6. Deprecated / avoid
Notifee (archived 2026-04-07); expo-av (removed SDK 55; use expo-video/expo-audio); expo-barcode-scanner (expo-camera does QR); react-test-renderer (no React 19); `@react-navigation/*` imports in app code (SDK 56+); `ImageManipulator.manipulateAsync` and `MediaTypeOptions` (deprecated); `@expo/vector-icons` (deprecated SDK 56); react-native-document-scanner-plugin (open SDK 55 build issue, last push Jan 2026); unpinned reanimated 4.6 / gesture-handler 3 / skia 2.11 (peer mismatch with SDK 57); Expo Go for anything with a config plugin.

## 7. Widget reality check (the proposal's lock-screen card)
- Android App Widgets are home-screen widgets. Android 16 QPR2 brought lock-screen widgets back only on Pixel phones (Android Authority, 2026: https://www.androidauthority.com/lock-screen-widgets-on-phones-android-16-qpr2-3589668/). On the team's Android phone the honest, demoable "no-unlock" surface is: (a) a home-screen widget via react-native-android-widget, plus (b) a persistent, public-visibility notification via expo-notifications (`sticky: true`, channel `lockscreenVisibility: PUBLIC`) that is readable on the lock screen. Document this substitution in the README limitations.
- iOS lock-screen widgets via expo-widgets (accessoryRectangular) exist but need an EAS iOS cloud build plus an Apple Developer account -- stretch only.
