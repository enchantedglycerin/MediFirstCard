# Decisions log

One entry per deviation from `PLAN.md`, and the results of the Week-1 spikes. Newest first.

## 2026-09-03 — W2 backend built and verified (deviations from PLAN)

Built and tested the authenticated API: auth (register/login/refresh-rotation/logout), profile + 4 sub-collections + lock-screen-fields + emergency-card (QR), records (create/dedupe/upload/confirm/list/get/blob/review/delete), and mock AI extraction. 16 API + 11 shared tests pass; the server boots on disk-backed PGlite and ran the full flow live over HTTP.

Deviations from PLAN, all deliberate:
- **Database driver: PGlite (WASM Postgres) locally/CI, node-postgres on Render.** PLAN assumed Docker for local Postgres; this machine has no Docker. `DATABASE_URL` set → real Postgres (Render/Supabase); unset → PGlite (in-memory for tests, on disk at `apps/api/.data/pg` for dev). Removes the Docker dependency for the whole team and CI. `docker-compose.yml` stays for anyone who wants real PG parity.
- **Password/PIN hashing: Node `scrypt` (memory-hard, built in), not argon2.** Avoids a native build on Windows/CI/Render. Same security class; can swap to argon2 later. Stored as `scrypt$N$r$p$salt$hash`.
- **Supabase Storage adapter deferred.** Local-disk storage adapter implemented and tested; `getStorage()` throws a clear message for `STORAGE_PROVIDER=supabase` until the cloud adapter is wired at deploy time. The full records flow works on local storage.
- **Gemini + Typhoon extraction deferred to the next batch.** `EXTRACT_PROVIDER=mock` is implemented and tested (returns a canned Thai sick-leave extraction with one deliberately low-confidence field for the red-field review flow). `EXTRACT_PROVIDER=gemini` returns 501 until wired. Deps (`@google/genai`) not yet installed.
- **Public pages (/e, /s), share links (records scope), alerts, consent, notifications** are the next batch; the emergency share link + token + QR already exist (used by the emergency-card endpoint).
- **npm audit: 4 moderate, accepted.** All are the esbuild dev-server advisory (GHSA-67mh-4wv8-2f99) pulled in transitively by `drizzle-kit` (a dev-only tool; we never run esbuild's dev server). The API's own esbuild is 0.28.2 (unaffected). Not running `audit fix --force` (would break drizzle-kit).

## 2026-09-03 — Phase 0 scaffold created

## 2026-09-03 — Phase 0 scaffold created

- Monorepo created at `c:\workspace\MediFirstCard` with npm workspaces (`packages/*`, `apps/*`). **Move to `C:\mfc` before the first Android build** (PLAN §4: Node resolves junctions, so the short path must be the real repo path to avoid the 260-char CMake failure).
- `@mfc/shared` built first as the contract both apps import (zod schemas, `buildCardPayload`, Buddhist-era date helpers, i18n keys).
- `apps/api` scaffolded with the health module, env validation, AES-256-GCM field encryption and the Express app; auth/profile/records/extract/share modules land in W2–W3.
- AI stack is Typhoon OCR + Gemini free tier (no Claude); hosting is Supabase + Render (no card). Firebase is the card-required alternative in PLAN appendix.

## 2026-09-03 — Emulator: MuMu Player available

The team has MuMu Player, so it is the primary fast-iteration emulator for the app UI, navigation, forms, camera (feed a fixture image through MuMu's virtual camera for the scan demo), notifications and the home-screen widget. Two caveats the plan depends on:
- MuMu runs Android 12/13 (x86_64), **not** Android 16 QPR2, so it will **not** show the lock-screen widget hub. The lock-screen widget (F07 / spike S-A) still needs a Pixel on Android 16 QPR2 or an Android Studio AVD with the API 36.1 image. On MuMu, demo the lock-screen **notification card** and **wallpaper card** instead — both work there and on every real phone.
- x86_64 ABI: build the dev client and release APK for x86_64 too (Expo/Hermes support it). Connect with `adb connect 127.0.0.1:7555` (MuMu Player 12 uses 16384) then `npx expo run:android`.

Keep a physical Android phone as the primary demo device (the release build runs there); MuMu is for development speed.

## 2026-09-03 — Android native build setup (run from apps/mobile!)

Hit while doing the first `expo run:android`:
- **Run it from `apps/mobile`, never the repo root.** Running `npx expo run:android` at the repo root made Expo treat the whole monorepo as the app: it created `android/` at the root and appended `expo/react/react-native` to the root `package.json`. Fixed by removing those. Always `cd apps/mobile` first.
- **SDK location:** set `ANDROID_HOME` (persisted via `setx` to `C:\Users\Lolicon_Cafe\AppData\Local\Android\Sdk`); Expo writes `apps/mobile/android/local.properties` from it. If a build still says "SDK location not found", create `apps/mobile/android/local.properties` with `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk` (forward slashes).
- **Removed the `expo-font` native plugin** from app.json: in a monorepo the Sarabun `.ttf` files are hoisted to the root `node_modules`, so the plugin's `node_modules/@expo-google-fonts/...` path fails at prebuild. Fonts load at runtime via `useFonts` in `_layout.tsx`, so nothing is lost. (To embed fonts natively later, pass absolute paths or the required-module form.)
- **Removed `android.edgeToEdgeEnabled`** from app.json: Android 16 makes edge-to-edge mandatory and the key is now rejected by prebuild.
- **Gradle heap:** added `org.gradle.jvmargs=-Xmx4096m` to the user-level `~/.gradle/gradle.properties` (survives `expo prebuild`, which regenerates the gitignored `apps/mobile/android`).
- Java 21 is installed and compiled the Expo Gradle plugin fine; JDK 17 is the documented recommendation but 21 works here.
- A physical Android device is attached over USB (`adb devices` → `R58N21293HM`), so builds install and run on it.

## 2026-09-03 — Mobile app scaffolded and bundling

- Expo SDK 57 default template (Expo Router, RN 0.86.3, React 19.2.3) under `apps/mobile`; routes live in `src/app/` (template uses a `src` dir), not `app/` as PLAN §7 wrote — same structure, different folder.
- **Metro monorepo resolver** (`apps/mobile/metro.config.js`): watches the workspace root and rewrites NodeNext-style `.js` import specifiers to their `.ts` sources, so `@mfc/shared` (which uses `.js` specifiers for the API's NodeNext build) also resolves under Metro's bundler resolution. Without this, Metro fails on `@mfc/shared`'s internal imports. This is the fix PLAN §4 anticipated.
- Verified: the whole app typechecks (`tsc --noEmit`) and bundles (`npx expo export --platform android`, 2000+ modules → Hermes bundle). Not yet run on a device — that is the team's step (`npx expo run:android` on MuMu or a phone; MuMu shows the notification/wallpaper card but not the Android 16 lock-screen widget, see the MuMu note above).
- react-hook-form was installed but the forms use plain `useState` + Paper inputs (simpler, fewer generics); the dep can be removed or used later.

### Spike results (fill in during W1)
- S-A widget: _pending_
- S-B notification (Android 13+): _pending_
- S-D Gemini + Typhoon via Render, real free-tier limits from AI Studio: _pending_
- S-G offline queue: _pending_
- S-H release build + Server URL switch: _pending_

## 2026-09-04 — Dev-server gotchas found while testing on the phone

- **Metro started from an automated/background shell ran in CI mode** ("Metro is running in CI mode, reloads are disabled") because that shell exported `CI=true`. In CI mode Metro never watches files, so edits are never bundled and the app sits on the splash screen forever. Start Metro from a normal terminal (`npx expo start` in `apps/mobile`) or strip the variable: `env -u CI npx expo start`.
- **The debug app asks for its bundle on port 8082, not 8081.** The first `expo run:android` found 8081 busy and baked 8082 into the debug build's dev-server settings. Either run Metro on 8082 (`npx expo start --port 8082`) or forward the phone's 8082 to wherever Metro is: `adb reverse tcp:8082 tcp:8081`. Symptom when wrong: native splash never hides, Metro log shows no "Android Bundled" line, no JS errors anywhere.
- Git Bash rewrites `/sdcard/...` arguments into `C:/Program Files/Git/sdcard/...` before adb sees them. Prefix adb commands with `MSYS_NO_PATHCONV=1` (or quote the whole `adb shell "..."` string).

## 2026-09-04 — Mobile rebuild: what was wrong and what changed

Found while using the first build on a real phone: no route guard (an expired session left the user on a broken Home), the extraction review was read-only, the rescuer preview was unreachable, alert titles were a broken expression, the "lock-screen card" was only a field picker with no notification, any network error read as "photo not clear", lock-screen save failed silently without a profile, hardcoded English mixed into the Thai UI, and no UI at all for contacts/conditions/medications, clinician sharing, account deletion or the PIN the library already supported.

Changes (all deliberate, all verified on-device):
- **Emergency contacts** are a first-class list (name, relationship, Thai phone validated `0XXXXXXXXX` and normalised, priority, informed-consent flag). `CardLine.phone` carries a dialable number so the app card, the rescuer preview, the pinned notification and the public `/e/:token` page all offer tap-to-call. Every rescuer surface also shows **Call 1669** (Thai EMS).
- **Lock-screen card = pinned notification.** `expo-notifications` local notification on a MAX-importance channel with `lockscreenVisibility: PUBLIC`, `sticky: true`, `autoDismiss: false`; re-posted whenever the field selection changes; Android 13+ permission requested on toggle. Confirmed via `dumpsys notification` (flags=0x2 ongoing, importance 5).
- **One card renderer** (`components/EmergencyCardView`) and **one collection editor** (`components/CollectionEditor`) back all the list screens, so the four medical lists share validation, dialogs, delete-confirm and error handling.
- **Route guard in the root layout** (`useSegments`): signed-out → /login, PIN set → /lock until verified (biometrics offered), otherwise away from auth screens.
- **i18n is complete**: every string goes through `t()`; en.json and th.json have identical key sets (checked by script). Consent keeps the specific PDPA wording (named AI providers, purposes, 30-day erasure).
- **expo-crypto `digest` on Android rejects a detached `ArrayBuffer`** ("Cannot convert '[object ArrayBuffer]' to a Kotlin type"). Pass a `Uint8Array` instead. This silently broke the whole scan pipeline before the first API call.
- **Android edge-to-edge**: a fixed-height tab bar sat under the system navigation buttons; the bar now adds `useSafeAreaInsets().bottom`.
- **Paper Snackbars must live in a `<Portal>`** or they render inline at the top of a scroll view instead of the bottom of the screen.
- Blood-type picker uses chips (five segmented buttons overflowed the row).
- Snackbar/route/typed-routes housekeeping: the verifier regenerated `.expo/types/router.d.ts`; typed routes only learn about new screens when Metro is watching (see the CI-mode note above).
- **Token refresh is single-flight.** The 15-minute access token expired while a screen fired several queries at once; each 401 triggered its own `/auth/refresh` with the same refresh token, the server's reuse detection revoked the token family and the user was signed out. `lib/api.ts` now shares one in-flight refresh promise across all waiters (found on the phone at minute 16 of the session).

## 2026-09-04 — Live providers

The extraction pipeline and blob storage now have real adapters behind the existing env switches. Nothing changes for dev/CI, which stay on `EXTRACT_PROVIDER=mock` + `STORAGE_PROVIDER=local`; the 501 `PROVIDER_NOT_WIRED` / "not wired yet" branches are gone.

- **Raw `fetch`, no SDKs.** Gemini, Typhoon and Supabase Storage are called over their REST APIs with the native `fetch` in Node 24 (`apps/api/src/modules/extract/providers/{gemini,typhoon}.ts`, `apps/api/src/storage/supabase.ts`). Zero new dependencies, and every adapter takes an injectable `fetchImpl`, so the adapter tests run offline against a fake fetch that asserts the request (URL, headers, body shape) and answers with canned responses. Shared helpers (`ProviderError`, `withRetry`, `isRetryableStatus`, `clampConfidence`, `extractJsonObject`) live in `providers/common.ts`.
- **Two-call pipeline, OCR as extra context.** `runExtraction` (`providers/index.ts`) optionally runs Typhoon OCR first (`OCR_PROVIDER=typhoon`; model `typhoon-ocr` on the OpenAI-compatible `/chat/completions`, the exact v1.5 prompt from the official package, image as a data URI), then sends the image *and* the OCR Markdown to Gemini `generateContent` with `responseMimeType: application/json` + `responseJsonSchema` = `EXTRACTION_JSON_SCHEMA` from `@mfc/shared`. The prompt tells Gemini the transcript may contain errors and to prefer the image. Output is validated with `extractionSchema`; confidences are clamped to 0..1. `model` is recorded as e.g. `gemini-2.5-flash-lite+typhoon-ocr`.
- **Retries and mock fallback with warnings.** 408/429/5xx and network errors retry with exponential backoff (3 retries; the Typhoon free tier is 20 req/min); 4xx, safety blocks and invalid model output do not. Typhoon failure → warning `ocr_unavailable`, Gemini still runs on the image. Gemini failure, or no key, → the deterministic mock extraction, always labelled `source: "mock"` with `ai_provider_unavailable` / `ai_provider_not_configured` (the route adds `mock provider`), so a provider outage never kills the demo and mock output is never presented as live. Diagnostics are one `console.warn` line carrying the provider error message only — never keys or document content.
- **Supabase Storage over REST.** `SupabaseStorage` implements the same `StorageAdapter` as local disk: `POST /storage/v1/object/{bucket}/{path}` with `x-upsert`, `GET` / `HEAD /object/authenticated/{bucket}/{path}` for read / exists (always requires auth, so a bad key fails loudly on a private bucket), `DELETE /object/{bucket}` with `{ prefixes }`. Endpoints checked against the storage server routes and storage-js. `STORAGE_PROVIDER=supabase` without `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` fails on first use with a message naming the missing variable.
- **Route change.** `POST /records/:id/extract` now reads the uploaded bytes for every provider (mock included), so it returns `409 NO_BLOB` before the upload step — the same rule as `/confirm`; the app always uploads first. The `provider` column stores the effective provider (`gemini` or `mock`) and the response gains `model`.
- **Caveats.** No live call has been made yet (no keys provisioned; tests are offline by design). Gemini `temperature` is deprecated per the July 2026 changelog and should be dropped from `buildGeminiRequestBody` if a live 400 mentions it; `$defs/$ref` in `responseJsonSchema` is documented in the SDK types but not on the current structured-output page (the fix would be inlining in `packages/shared`). Images go to Typhoon without the ~1800 px downscale the official package applies. `/explain` is still mock. Both free tiers may use inputs to improve the models → synthetic documents only (README Limitations).

## 2026-09-04 — Release build for the demo phone

- `expo-build-properties` sets `android.usesCleartextTraffic=true` so the release APK can talk to the API on the laptop over plain HTTP (`http://<laptop-ip>:3000`). Only the debug manifest had it before, so a release build would have failed silently against a LAN server. Remove the flag once the API is on Render (HTTPS).
- The release variant is signed with the generated **debug keystore** (Expo's default `signingConfigs.debug` for release). That is fine for installing on the team's phones and for the demo; a Play Store upload would need a real keystore.
- The APK is 123 MB because it bundles all four ABIs; `-PreactNativeArchitectures=arm64-v8a` would cut it to ~35 MB for a single phone. Built with `npx expo prebuild --platform android --clean` followed by `npx expo run:android --variant release --no-bundler` from `apps/mobile`.
- Published as a GitHub pre-release asset so members can install it without Android Studio: `adb install -r app-release.apk`, then set More → Developer → Server URL.

## 2026-09-04 — Signed release and cloud go-live

- **Release signing.** A 2048-bit RSA keystore (`apps/mobile/credentials/release.keystore`, alias `medifirstcard`, valid to 2054) signs every release build; passwords sit next to it in `keystore.properties`. Both are gitignored — the lead developer backs them up privately and shares them only with whoever builds releases. Losing the keystore means future updates cannot install over the published app (users would have to uninstall). Certificate SHA-256 `07:41:48:86:…:22:2C:9D` is printed in the README so anyone can verify an APK.
- **Config plugin instead of hand-editing Gradle.** `plugins/withReleaseSigning.js` patches `android/app/build.gradle` at prebuild (`android/` is generated and gitignored), so `expo prebuild --clean` never loses the signing config. When `credentials/keystore.properties` is missing the release build silently uses the debug keystore, which keeps CI and teammates working.
- **Gemini model.** `gemini-2.5-flash-lite` is retired for new accounts (HTTP 404 "no longer available to new users"); default is now `gemini-3.5-flash-lite`. Verified live with the user's key: the synthetic sick-leave certificate was read with every field correct at 100 % confidence, in 6.9 s, with Typhoon OCR text as extra context (`model=gemini-3.5-flash-lite+typhoon-ocr`).
- **Supabase Storage.** The `records` bucket was created through the Storage API (private). `HEAD` on a missing object returns 400 with `statusCode: "404"` in the body, not a plain 404; `exists()` treats both as "not found".
- **Supabase database.** Session-pooler URI on port 5432 (IPv4). The project is in `ap-northeast-2` (Seoul); `ap-southeast-1` (Singapore) would have been closer to Thailand, but latency is acceptable for a demo.
- **Gradle daemon lock.** `expo prebuild --clean` fails with EBUSY on Windows while a Gradle daemon still holds `app/build/…/classes.dex`; stop the daemons (`taskkill /F /IM java.exe` when nothing else uses Java) before cleaning.

## 2026-09-04 — Render deployment package

- `render.yaml` is a complete Blueprint: `medifirstcard-api`, Node runtime, Singapore, free plan, `/health` check, auto-deploy on push, migrations run in the build step, every variable declared (secrets `sync: false` so Render prompts for them once). Nothing is hard-coded that Render provides itself.
- **Public URL comes from Render.** `PUBLIC_BASE_URL` falls back to `RENDER_EXTERNAL_URL`, and an empty value counts as unset (an empty `PUBLIC_BASE_URL=` used to produce links like `/e/<token>` with no host).
- **Migrations from the bundle.** `dist/server.mjs` (what `npm start` runs on Render) resolved the Drizzle folder relative to the source tree and crashed with "Can't find meta/_journal.json". The resolver now checks `../../drizzle`, `../drizzle` and `<cwd>/drizzle`. Found by booting the bundle locally with the cloud `.env` — do that before every deploy-related change.
- **Release app defaults to the Render URL** via `apps/mobile/.env.production` (public value, committed, loaded by Expo for release bundles). If Render gives the service a suffixed name, users set More → Developer → Server URL once.
- Render itself still needs the account owner to click New → Blueprint and paste the seven secrets (docs/deploy-render.md); or hand over a Render API key and it can be scripted.

## 2026-09-04 — Alert e-mail goes to the owner, not a fixed address

`recordView()` now e-mails the card owner at their **own account address** through Resend's REST API (raw fetch, retried on 429/5xx, bilingual subject/body per alert kind, Bangkok time). `ALERT_EMAIL_TO` remains only as an override for Resend's free tier, which cannot deliver to anyone but the account owner until a domain is verified. The mail is fire-and-forget: the rescuer/clinician page never waits for or fails on the mail provider, and a 403 (free-tier restriction) is logged with a hint. Six offline tests cover the request shape, retry/no-retry, per-user recipient, override and the no-key path.

## 2026-09-04 — App icon

The team's artwork (1254 px, opaque, rounded black corners baked in) is turned into every Android/Expo asset by `apps/mobile/scripts/make-icons.ps1` (System.Drawing, no extra tools): `icon.png` 1024 full-bleed; adaptive **foreground** at 86 % on a transparent canvas so the card and character survive the circular mask; adaptive **background** solid navy `#0A1730` sampled from the artwork; **monochrome** (Android 13 themed icons) and the **notification** small icon as a drawn white card-with-cross silhouette, because a photo-style artwork cannot be used as a silhouette; splash 512 and favicon 48. `expo-notifications` now points at the notification glyph instead of the default Expo icon.
