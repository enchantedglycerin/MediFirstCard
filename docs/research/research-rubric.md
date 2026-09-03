# MediFirstCard - Exhaustive Grading Checklist (course brief + proposal)

Research date: 2026-09-03. Sources: `c:/workspace/MediFirstCard/Mini_Project_Brief_EN.txt` (the "Brief"), `c:/workspace/MediFirstCard/MediFirstCard_Proposal_EN.txt` (the "Proposal"), plus web evidence listed inline. Brief line numbers refer to the Read output of the .txt file.

Verification legend: [FETCHED-TODAY] = primary source fetched in this run; [DIGEST] = fetched by the previous agent and visible in the digest; [UNVERIFIED] = not fetched.

---

## 0. Score map (what is still winnable)

| Component | Points | Due | Source |
|---|---|---|---|
| App Proposal | 5 (already earned if submitted complete by 30 Aug 2026) | 30 Aug 2026 23:59 | Brief L31, L51 |
| App Intro Video + Live Demo - Peer Assessment | 10 (25 raw, scaled) | 7 Oct 2026, video 12:30, demo 13:00-16:00 | Brief L32-34, L134-141 |
| App Intro Video + Live Demo - Instructor Assessment | 5 | 7 Oct 2026 13:00-16:00 | Brief L34, L143-149 |
| GitHub Documentation / Technical Implementation | 20 | 11 Oct 2026 23:59 | Brief L35, L182-191 |
| Total | 40 | | Brief L36 |
| IPAC multiplier | Adjusts each individual's score after the group score | - | Brief L193-194 |

35 of 40 points remain in play in the next 5 weeks; all of them depend on artifacts produced between now and 11 Oct.

---

## (a) Every explicit deliverable / requirement, with source and how the plan satisfies it

### A1. Core Requirements (Brief L53-63) - all mandatory, gate for "Core capabilities of the app" (4 pts, L184) and "Completeness and stability" (peer 5, L136)

| # | Requirement (verbatim) | Source | How the plan must satisfy it |
|---|---|---|---|
| C1 | "A React Native app that actually runs." | Brief L54 | Expo SDK 57 (expo 57.0.19, RN 0.87.1 on npm today [FETCHED-TODAY]; SDK 57 ships RN 0.86 per changelog [DIGEST https://expo.dev/changelog/sdk-57]) Android development build installed on a physical Android phone AND an Android Studio emulator (API 36 "Baklava" image [DIGEST https://developer.android.com/about/versions/16/qpr2/get]). Prove it with a release APK in GitHub Releases plus a "Run" section in README. |
| C2 | "At least 3 screens." | Brief L55 | Plan >= 7 screens: Onboarding/Consent, Login/PIN, Home Dashboard, Emergency Card (public preview), Card Field Picker (lock-screen privacy), Records Archive list, Record Detail/Scan, Settings/Export. |
| C3 | "Navigation between screens." | Brief L56 | expo-router 57.0.18 (file-based, on @react-navigation/native 7.3.18) [FETCHED-TODAY npm]. Tabs + stack + modal so navigation is visibly demonstrated. |
| C4 | "At least 1 form of user input or data source." | Brief L57 | Three: (i) profile form with validation, (ii) camera/photo upload via expo-camera 57.0.4 / expo-image-picker 57.0.15, (iii) REST backend data source. |
| C5 | "A result / output / dashboard screen." | Brief L58 | Home Dashboard: card completeness %, allergy/chronic counts, record counts by type, last sync time, "next steps" panel; plus the Emergency Card itself as the "output". |
| C6 | "A clear biomedical or healthcare context." | Brief L59 | Emergency ID + medical records; use clinical labels (blood group, allergies with severity, chronic conditions, medications, emergency contacts, ICD-style categories optional). |
| C7 | "A GitHub repository." | Brief L60 | Public repo, monorepo `apps/mobile` + `apps/api`, branch protection with PRs, all three members committing under their own GitHub accounts. |
| C8 | "A README with installation and run instructions." | Brief L61 | README in the exact order of Brief L166-180 (see section (c)). |
| C9 | "Evidence of it working, e.g. screenshots or video." | Brief L62 | `/docs/screenshots/*.png` (min 8) + YouTube (unlisted) demo link + GIF of lock-screen widget. |
| C10 | "A statement declaring that it is a prototype for educational purposes, not a real medical diagnostic or treatment device." | Brief L63 | Put it in THREE places: README top banner, in-app Consent screen, and app About screen. Exact wording: "MediFirstCard is a student prototype for educational purposes (040333215 Smart Technology 2026). It is not a medical device and must not be used for diagnosis or treatment decisions." |

### A2. Advanced Features Requirement (Brief L65-108) - see section (b)

### A3. App Introduction Video (Brief L110-120) - see section (e)

### A4. Live Demo (Brief L122-132) - see section (d)

### A5. GitHub repository required items (Brief L153-164)

| Item | Source | Where in repo |
|---|---|---|
| Source code | L155 | `apps/mobile`, `apps/api`, `packages/shared` |
| README.md file | L156 | root `README.md` |
| Installation instructions | L157 | README "Installation steps" |
| App features | L158 | README "Main features and advanced features" |
| System architecture diagram | L159 | `docs/architecture.png` + Mermaid block in README |
| Screenshots of the app | L160 | `docs/screenshots/` embedded in README |
| Demo video link | L161 | README "Demo video link" (same unlisted YouTube URL used on 7 Oct) |
| Limitations | L162 | README "Limitations" |
| Roles of the group members | L163 | README "Group members and their roles" + `CONTRIBUTORS.md` mapping each member to folders/PRs |
| Commit history in GitHub | L164 | Real per-member commits; never squash-merge everything under one account (see section (h)) |

### A6. GitHub grading rows (Brief L182-191) mapped to concrete evidence

| Criterion | Pts | Evidence the grader must be able to find in < 2 minutes |
|---|---|---|
| Core capabilities of the app | 4 | Release APK; screens listed; screenshots; video |
| System integration and advanced features | 4 | README table "Advanced features" with category + file path + screenshot for each of the 5 features |
| Data management and app state management | 3 | `packages/shared/schema.ts` (zod 4.5.4), SQL migrations with `created_at/updated_at`, zustand 5.0.15 store + @tanstack/react-query 5.102.8 cache, sync/history table |
| Code quality and project structure | 3 | ESLint + Prettier + TypeScript strict, folder README per package, conventional commits, PR template |
| Testing, error handling, and system stability | 2 | jest-expo 57.0.5 unit tests for validators + supertest 7.2.2 API tests, GitHub Actions CI badge, error boundary + offline banner + retry |
| Documentation and reproducibility | 3 | `.env.example`, `docker-compose.yml` for Postgres, seed script, one-command run, Node version pinned (`.nvmrc` = 24) |
| Responsible biomedical design | 1 | Consent screen, disclaimer, field-level privacy picker, "Responsible use" README section, no diagnosis claims |

---

## (b) Advanced-feature rules for a 3-person team and the suggested slate of 7

### Rules (Brief L66)
- Team of 3 => minimum 5 advanced features (4-person teams need 6).
- From at least 3 of the 5 categories.
- At least 2 must be "genuine system integration" (the examples listed at L67-68: API, Backend, Database, Sensor, Node-RED, AI/ML inference, Cloud storage, Automation workflow).
- Categories: 1 Data and Storage (L70-76); 2 API, Backend, and Automation (L78-84); 3 Sensor and IoT (L86-92); 4 AI/ML/Medical AI (L94-100); 5 Medical UI/UX and Clinical Workflow (L102-108).

### Suggested slate: 5 official + 2 spares

| # | Feature | Category (Brief line) | Genuine integration? | Packages / services (versions verified today on npm unless noted) | Peer row (L136-140) | Instructor row (L145-148) | GitHub row (L184-190) |
|---|---|---|---|---|---|---|---|
| O1 | Custom Express REST backend with JWT auth, storing profiles + records in PostgreSQL, TLS in transit | Cat 2 "Custom backend, e.g. Express / FastAPI" (L80) + "REST API integration" (L79) | YES (Backend + API) | express 5.2.1, pg 8.23.0, jsonwebtoken 9.0.3, bcryptjs 3.0.3, zod 4.5.4, helmet 8.3.0, cors 2.8.6, express-rate-limit 8.7.0, multer 2.3.0 [DIGEST npm]; host: Render free (spins down after 15 min idle, ~1 min cold start, 750 h/month, free Postgres expires after 30 days) [DIGEST https://render.com/docs/free]; DB: Neon Free (0.5 GB/project, 100 CU-hours/project, no card) [DIGEST https://neon.com/pricing] or Supabase Free (500 MB DB, 1 GB storage, pauses after 1 week inactivity) [DIGEST https://supabase.com/pricing] | Integration/correctness (5), Data mgmt (5) | Technical explanation (1.5) | System integration (4), Data mgmt (3) |
| O2 | Cloud database + encrypted cloud file storage for scanned documents (Postgres + object storage) | Cat 1 "Firebase / Supabase / cloud database" (L71) + Cat 1 "Structured data schema with timestamp and metadata" (L75) | YES (Database + Cloud storage) | Neon/Supabase Postgres; files: Supabase Storage (1 GB free) or Cloudflare R2 (10 GB-month free, 1M Class A, 10M Class B, free egress) [DIGEST https://developers.cloudflare.com/r2/pricing/]; AES-256-GCM app-layer encryption of document blobs with per-user key via expo-crypto 57.0.2 | Data mgmt (5) | Technical explanation (1.5) | Data mgmt (3), System integration (4) |
| O3 | Android lock-screen / home-screen Emergency Card widget (OS API integration) with user-chosen fields | Proposal S4/S6 promise; counts as Cat 2 "REST API integration" consumer + Cat 5 "Accessibility, e.g. large font, clear warning" (L106); a genuine OS integration | Treat as integration (OS widget API pulling data from backend/local store) | react-native-android-widget 0.22.1 (published 2026-08-17 [FETCHED-TODAY npm registry `time`]; peerDependency expo >= 54 optional; ships `app.plugin.ts` config plugin [DIGEST https://registry.npmjs.org/react-native-android-widget/latest]; requires an Expo Dev Client build, not Expo Go [FETCHED-TODAY https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-widget-expo]). Lock-screen placement: Android 16 QPR2 on Pixel ("Settings > Display & touch > Lock screen > Widgets on lock screen") [DIGEST https://www.androidauthority.com/android-16-qpr2-lock-screen-widgets-pixel-phones-how-use-3621781/]; Google FAQ: "All widgets are compatible with the lock screen widget experience", opt-out via `not_keyguard` [DIGEST https://android-developers.googleblog.com/2025/03/widgets-on-lock-screen-faq.html]. Emulator: API 36 Baklava image [DIGEST https://developer.android.com/about/versions/16/qpr2/get]. Fallback on non-Pixel phones: persistent lock-screen notification via expo-notifications 57.0.16 channel `lockscreenVisibility: AndroidNotificationVisibility.PUBLIC` + content `sticky: true` [FETCHED-TODAY https://docs.expo.dev/versions/latest/sdk/notifications/]. | Completeness (5), UI/UX (5) | Working demo (1.5), Biomedical relevance (1.0) | Core capabilities (4), Responsible design (1) |
| O4 | Local persistent encrypted storage + offline-first history with sync timestamps | Cat 1 "Local persistent storage, e.g. AsyncStorage / SQLite" (L72) + "Patient/session history" (L73) + "Basic data validation" (L76) | No (but strong Data Mgmt evidence) | expo-sqlite 57.0.2 (openDatabaseAsync/runAsync/getAllAsync, works in Expo Go [DIGEST https://docs.expo.dev/versions/latest/sdk/sqlite/]), expo-secure-store 57.0.3 (Android Keystore; keep values < 2048 bytes; `requireAuthentication` option [DIGEST https://docs.expo.dev/versions/latest/sdk/securestore/]), zod validators (missing value, invalid range e.g. weight 1-500 kg, duplicate record by hash of file) | Data mgmt (5), Completeness (5) | Technical explanation (1.5) | Data mgmt (3), Testing (2) |
| O5 | Consent/privacy notice + PIN/biometric gate + role-based "Emergency responder view" vs "Owner view" + clinically meaningful severity labels | Cat 5 "Consent / privacy notice screen" (L104), "Role-based interface" (L103), "Clinically meaningful status labels" (L105), "Accessibility" (L106) | No | expo-local-authentication 57.0.2 (`authenticateAsync`, device passcode fallback) [DIGEST https://docs.expo.dev/versions/latest/sdk/local-authentication/]; bcrypt-hashed PIN stored server-side; allergy severity labels mild / severe / life-threatening; large-font mode for elderly | UI/UX (5), Technical understanding (5) | Biomedical relevance and responsible use (1.0), Q&A (1.0) | Responsible design (1), Core (4) |
| S1 (spare) | OCR of medical certificate to pre-fill record fields (English/Latin on-device; Thai via cloud) with confidence display and "please verify" prompt | Cat 4 "AI/ML inference API" (L95) + "Confidence score or probability display" (L99) | YES (AI/ML inference) | On-device: @react-native-ml-kit/text-recognition 2.0.0 (Latin, Chinese, Devanagari, Japanese, Korean; Thai NOT supported) [DIGEST https://developers.google.com/ml-kit/vision/text-recognition/v2]; Thai: tesseract.js 7.0.0 on the Express server with `tha` traineddata (listed in tessdoc; NOT in tessdata_fast) [DIGEST https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html] OR Gemini API free tier (Flash models listed free) [DIGEST https://ai.google.dev/gemini-api/docs/pricing] | Integration (5) | Technical explanation (1.5) | System integration (4) |
| S2 (spare) | PDF export of the Emergency Card and record summary with limitations statement + share sheet | Cat 1 "Export data as a CSV / JSON / PDF report" (L74) + Cat 5 "Summary report that clearly states limitations and next steps" (L108) | No | expo-print 57.0.1 (`printToFileAsync({html})` returns `{uri, numberOfPages}`, works in Expo Go) [DIGEST https://docs.expo.dev/versions/latest/sdk/print/], expo-sharing 57.0.17 | Completeness (5), UI/UX (5) | Biomedical relevance (1.0) | Core (4), Responsible design (1) |

Category coverage with O1-O5: Cat 1 (O2, O4), Cat 2 (O1, O3), Cat 5 (O5) = 3 categories; genuine integrations: O1, O2 (and O3 arguably) = >= 2. Adding S1 gives Cat 4 and a third unambiguous integration; adding S2 costs about half a day and is nearly risk-free. Recommendation: ship O1-O5 + S2 as the guaranteed six, S1 as the seventh if Week 3 finishes on time.

Do NOT claim: Cat 3 Sensor/IoT (no sensor in the proposal; graders will see it as padding), or "Node-RED / n8n" unless actually deployed.

---

## (c) README section list in the Brief's order (Brief L166-180)

Use these exact headings, in this order (H2 each):
1. App name (L168) - plus one-line tagline, badges (CI, license), and the disclaimer banner immediately below.
2. Group members and their roles (L169) - table: Thai name, GitHub handle, role from Proposal S2, folders owned, notable PRs.
3. Problem and motivation (L170) - paraphrase Proposal S3.
4. Main features and advanced features of the app (L171) - two tables; advanced table columns: Feature | Brief category | Genuine integration (Y/N) | Code path | Screenshot.
5. System architecture diagram (L172) - PNG + Mermaid; show phone (RN app, SQLite, SecureStore, widget) -> HTTPS -> Express API (Render) -> Postgres (Neon/Supabase) + object storage; encryption boundaries labelled.
6. Installation steps (L173) - prerequisites (Node 24 LTS [DIGEST https://nodejs.org/en/about/previous-releases], JDK 17 via `choco install -y microsoft-openjdk17`, Android Studio with SDK Platform 36, ANDROID_HOME) [DIGEST https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=physical&mode=development-build&buildEnv=local]; `npm install` in each workspace; `.env.example` copy.
7. How to run the app (L174) - `npx expo run:android` (dev build with widget), `npm run dev` in `apps/api`, `docker compose up db`, or "install the APK from Releases and point it at the hosted API".
8. API / database / AI / sensor configuration (L175) - env vars table, DB migration command, OCR provider toggle, "Sensor: none (not applicable)".
9. Screenshots (L176) - grid of >= 8 screenshots incl. lock-screen widget photo.
10. Demo video link (L177) - unlisted YouTube; also the intro video.
11. Limitations (L178) - lock-screen widget only on Android 16 QPR2+ (Pixel) / One UI 8 (reported), iOS not built, OCR Thai accuracy, free-tier cold starts, not a medical device.
12. Future development directions (L179) - iOS WidgetKit, Thai OCR fine-tuning, hospital HL7 FHIR export, NFC tag.
13. A statement on responsible use (L180) - disclaimer + data-handling statement (PDPA-style consent, right to delete).

Repo extras required by L153-164 that are not README headings: `LICENSE`, `CONTRIBUTORS.md`, `docs/architecture.png`, commit history from all three accounts.

---

## (d) Live-demo script requirements (Brief L122-132)

Must show, in this order, with a named presenter for each:
1. "The app actually running" (L124) - physical phone mirrored via scrcpy (free, https://github.com/Genymobile/scrcpy [UNVERIFIED version]) AND the emulator open as fallback. 20 s.
2. "Navigation between screens" (L125) - Home -> Card -> Archive -> Settings tabs; open a record modal. 30 s.
3. "Receiving input or data from a source" (L126) - add a drug allergy with severity via form (show validation error for missing field), then scan a certificate with the camera. 60 s.
4. "Processing or calling an API/database/sensor/AI" (L127) - show the Express log terminal on the projector while the record uploads; show the row appear in Neon/Supabase table view; (if S1) show OCR result with confidence. 60 s.
5. "Displaying the results" (L128) - dashboard updates counts; press lock button and show the Emergency Card on the lock screen of the Pixel/emulator (or the sticky public notification on other phones). 45 s.
6. "Handling some errors or limitations" (L129) - THE ERROR MOMENT: toggle airplane mode -> app shows offline banner and queues the record; re-enable -> sync succeeds; then enter the wrong PIN 3 times -> lock-out message. Also verbally state the lock-screen-widget OS limitation. 45 s.
7. "Relevance to the biomedical use case" (L130) - close with the rescuer scenario: reads blood type + allergy + ICE number without unlocking. 20 s.

Backup rules (L132): "It is recommended to prepare a backup video or screenshots in case the internet, API, sensor, or server has problems"; "having only a backup video without any live component may not receive full marks". Therefore:
- Pre-warm the Render service 10 minutes before (free tier sleeps after 15 min idle [DIGEST https://render.com/docs/free]); keep a `curl` ping loop running.
- Have a local fallback: API running on the laptop exposed with `cloudflared tunnel --url http://localhost:3000` (TryCloudflare: free, no account, random temporary URL, 200 concurrent request cap) [DIGEST https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/], or phone on laptop hotspot hitting LAN IP.
- Offline mode must itself be a demonstrable feature so that loss of internet still leaves a live component.
- Backup video (2-3 min screen recording of the same script) on the laptop AND a phone; screenshots in a PDF.

Peer rubric rows to hit during demo: Completeness/stability (5), Integration correctness (5), UI/UX in medical context (5), Data management/structure (5), Technical understanding (5) (L136-140). Instructor: Working system (1.5), Technical explanation and architecture (1.5), Biomedical relevance and responsible use (1.0), Q&A/limitations/reflection (1.0) (L145-148). Prepare a one-slide architecture diagram and a 5-item "known limitations" slide for Q&A.

---

## (e) Intro-video requirements and 7-beat storyboard (Brief L110-120)

Hard limit: "no longer than 3 minutes" (L111). Must explain the seven items at L112-118. Deliver as MP4 1080p, subtitles Thai + English, shown at 12:30 on 7 Oct (L32).

| Beat | Time | Brief item | Content |
|---|---|---|---|
| 1 | 0:00-0:20 | The medical/healthcare problem (L112) | Locked phone at accident scene; lost certificates when changing hospitals (Proposal S3). |
| 2 | 0:20-0:35 | Target users (L113) | Elderly, chronically ill, high-risk; supporting: doctors, nurses, rescuers (Proposal S3). |
| 3 | 0:35-0:55 | Concept of the app (L114) | "Emergency card on the lock screen + private archive behind a PIN". |
| 4 | 0:55-1:35 | Main features (L115) | Screen recordings: card field picker, lock-screen widget, scan and upload, PIN/biometric gate. |
| 5 | 1:35-2:00 | Brief system architecture (L116) | Animated diagram: RN app -> Express REST (Render) -> Postgres (Neon) + storage; encryption at rest and in transit. |
| 6 | 2:00-2:30 | Advanced features chosen (L117) | On-screen list of the 5 (+ spares) with category badges. |
| 7 | 2:30-2:55 | Limitations of the prototype (L118) | Widget on lock screen needs Android 16 QPR2/One UI 8; iOS not built; OCR is assistive; free-tier cold start; disclaimer text on screen. |
| - | 2:55-3:00 | Credits | Names + roles; course code. |

Record with OBS Studio (free) + phone screen via scrcpy; edit in DaVinci Resolve or CapCut (free). Lock final cut by 3 Oct.

---

## (f) Week-by-week calendar 2026-09-03 -> 2026-10-11

Today is Thursday 3 Sep 2026. Deadlines: 7 Oct 12:30 video, 13:00-16:00 demo (Brief L32-34); 11 Oct 23:59 GitHub (L35).

| Week | Dates | Goals (owner) | Exit criteria |
|---|---|---|---|
| W1 | Thu 3 - Sun 6 Sep | Repo + CI + monorepo scaffold; Expo SDK 57 dev build running on phone and API 36 emulator (Dev); Figma wireframes for 7 screens, Thai/English copy (UX); data schema + API contract + README skeleton in Brief order (PM) | `npx expo run:android` works; empty screens navigable; first commit from all 3 members |
| W2 | Mon 7 - Sun 13 Sep | Express + Postgres (Neon) + JWT + zod validation + migrations (Dev); Consent, PIN, Profile form, Dashboard screens (UX+Dev); test harness jest-expo + supertest (PM) | O1, O4, O5 demonstrable end-to-end on phone |
| W3 | Mon 14 - Sun 20 Sep | Android widget via react-native-android-widget + field picker + lock-screen verification on API 36 emulator + notification fallback (Dev); Records archive with camera/upload to storage (Dev+UX); screenshots start (PM) | O2, O3 done; widget visible on emulator lock screen; APK v0.1 in Releases |
| W4 | Mon 21 - Sun 27 Sep | S2 PDF export; S1 OCR if on track; offline queue + error handling; accessibility large-font mode (Dev+UX); architecture diagram, README 80%, CONTRIBUTORS.md (PM) | Feature freeze Sun 27 Sep; all 5-7 features in README table |
| W5 | Mon 28 Sep - Sat 3 Oct | Bug bash, stability, seed demo data; record intro video + backup demo video; rehearse live demo twice with timer (all) | Video final cut 3 Oct; APK v1.0-rc; demo script printed |
| Buffer | Sun 4 - Tue 6 Oct | No new features. Pre-warm hosting, charge devices, export screenshots, print limitations slide | Dry run on 6 Oct with hotspot fallback |
| D-Day | Wed 7 Oct | 12:30 video; 13:00-16:00 live demo | - |
| Post | Thu 8 - Sat 10 Oct | Fix anything that broke on stage, finalize README (video link, screenshots), tag v1.0.0, verify every member's commits appear | README complete against L166-180 checklist |
| Submit | Sun 11 Oct by 20:00 (self-imposed, 4 h before 23:59) | Submit repo link | - |

Rule: any feature not working by 27 Sep is cut and moved to "Future development directions".

---

## (g) Every proposal promise graders will check, and how to satisfy or re-scope honestly

| Proposal promise | Section | Status / plan |
|---|---|---|
| Emergency Health ID Card on the Lock Screen via widget, "without having to unlock the phone, similar to a music player's control panel" | S4 bullet 1; S6 "Sensors & OS APIs: iOS WidgetKit and Android App Widget API" | SATISFY on Android: react-native-android-widget 0.22.1 home-screen widget; on Android 16 QPR2 Pixel and the API 36 emulator the same widget is placeable on the lock-screen hub page (Google: "All widgets are compatible with the lock screen widget experience") [DIGEST FAQ]. Samsung One UI 8 third-party lock-screen widgets reported by Geeky Gadgets (6 Nov 2025) [DIGEST] but Samsung support pages only mention pre-installed widgets [DIGEST https://www.samsung.com/au/support/mobile-devices/add-widgets-to-lock-screen/] - state as "reported, untested". Fallback for every Android: sticky PUBLIC-visibility notification card shown on lock screen. RE-SCOPE iOS: WidgetKit requires Xcode/macOS; none available (Windows 10). Say in README: "iOS lock-screen widget is designed but not built; would require EAS Build (free plan: 15 iOS builds/month, low-priority queue) [DIGEST https://expo.dev/pricing] plus an iPhone and Apple developer account." |
| Displays blood type, chronic illnesses, drug allergies, emergency contact numbers | S4 bullet 1 | SATISFY: exactly these four fields plus name/age; ICE number is tappable (opens dialer; on lock screen an activity needs authentication or `android:showWhenLocked="true"` [FETCHED-TODAY WebSearch summary of 9to5google/Android Authority]). |
| Medical Records & Certificates Archive with scan/photograph and upload, "transferring between healthcare facilities" | S4 bullet 2 | SATISFY: expo-camera / expo-image-picker -> encrypted upload -> list with type, date, hospital, tags; PDF export (S2) covers "transfer". |
| Security & Privacy Access with password | S4 bullet 3; S7 Week 3 | SATISFY: PIN (bcrypt-hashed server side + SecureStore local) + biometric via expo-local-authentication; auto-lock after 2 min; lock-out after 5 failures. |
| Client-Server: cross-platform Flutter/React Native client, RESTful API via Node.js/Express, "highly secure encrypted cloud database storage" | S5 | SATISFY: React Native (course requirement), Express 5.2.1 on Render, Postgres on Neon/Supabase (TLS enforced), app-layer AES-256-GCM for document blobs, HTTPS only. Mention which provider encrypts at rest (Neon/Supabase both do; cite their docs in README [UNVERIFIED]). |
| Database: PostgreSQL / Firebase Firestore, encrypted at rest and in transit | S6 | SATISFY with Postgres; mention Firestore was the alternative not chosen and why (relational records, SQL validation). |
| Camera to scan medical certificates | S6 | SATISFY (see archive). |
| AI OCR "Optional/Future Feature" | S6 | OPTIONAL: S1. If not built, list under "Future development directions" with the exact evidence that Thai is unsupported by ML Kit and would need tesseract `tha` or Gemini. This is honest and matches the proposal wording. |
| Timeline 4 weeks (W1 design, W2 frontend + widget, W3 backend + password, W4 testing + docs) | S7 | Re-scope to the 5-week calendar in (f); note in README that backend was built before the widget to de-risk integration. |
| Privacy contingency: "Allow users to choose which pieces of information they wish to display on the Lock Screen" | S8 | SATISFY: Card Field Picker screen with per-field toggles + preview; default = blood type + allergies only; store choice locally and sync. This directly earns Cat 5 consent/privacy credit and "Responsible biomedical design" (Brief L190). |
| Team roles (PM/SA, UX/UI + medical consultant, Lead full-stack) | S2 | Mirror in README and in commit history (see (h)). |

---

## (h) Biggest ways to lose points, and the IPAC implication

1. Demo dies on stage (peer Completeness 5, instructor Working system 1.5): free-tier cold start, hotel Wi-Fi, expired free Postgres (Render's expires after 30 days [DIGEST]) - mitigate with Neon (permanent free tier) or Supabase (pauses after 1 week idle - open the dashboard daily in the final week), pre-warm, hotspot, TryCloudflare tunnel, offline mode.
2. Widget not visible on the lock screen (the proposal's headline promise): needs Android 16 QPR2+ device or the API 36 emulator; verify in W3, keep the notification fallback and say so in Limitations. Do not over-claim; a grader with a Samsung/Xiaomi phone will not see a lock-screen widget.
3. Only a backup video, no live component -> explicitly "may not receive full marks" (Brief L132).
4. Missing the disclaimer statement (Brief L63) - a mandatory core requirement; costs Responsible design (1) and possibly Core (4).
5. README not reproducible (Documentation 3): missing `.env.example`, secrets committed, no Node/JDK version, no seed data. Test the README on a clean machine (a teammate's laptop) in W5.
6. Fewer than 5 advanced features or fewer than 3 categories or < 2 genuine integrations (Brief L66) -> System integration (4). Label each feature with category in README so the grader does not have to infer.
7. No tests / no error handling (Testing 2): ship at least 10 unit tests + 5 API tests + CI.
8. Video over 3 minutes (Brief L111) or missing one of the 7 required items (L112-118).
9. Proposal drift without explanation (instructor Q&A 1.0): keep a "Proposal vs delivered" table in README Limitations.
10. IPAC (Brief L193-194): "After the group score is known, individual scores are adjusted by the IPAC multiplier." IPAC (UCL methodology) combines peer-assessed individual contribution with the group mark so that "passengers" score lower [FETCHED-TODAY WebSearch: https://discovery.ucl.ac.uk/id/eprint/10092391/, https://www.ucl.ac.uk/engineering/ipac/help/resources/IPAC_Assessment_methodology_overview.pdf]. Because the Brief also lists "Commit history in GitHub" (L164) and "Work together as a team using GitHub and verifiable documentation" (L14), each member must have visible, attributable commits:
   - Every member commits from their own GitHub account with a verified email; PM owns docs/README/tests, UX owns screens/assets/i18n, Dev owns API/widget. Aim for a visible split (e.g. 25/25/50 %) rather than one author.
   - When the AI coding agent produces code, the member who directed and reviewed it commits it from their own account; for pair work add `Co-authored-by: Name <github-email>` trailers, which give contribution credit when the email is associated with the GitHub account [DIGEST https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors].
   - Use PRs with reviews from a second member; the review history is further IPAC evidence.
   - Keep a `docs/worklog.md` with dated entries per member.
   - The exact multiplier formula is in the "IPAC System" file on Google Classroom (not accessible here) - the team must read it.

---

## Environment facts verified on the dev machine (from the previous agent's local commands [DIGEST])
- node v24.15.0 (Active LTS), npm 11.12.1, Java 21.0.11 (Expo docs recommend JDK 17 - install microsoft-openjdk17 alongside), adb 1.0.41, git 2.54.0, Android SDK present but `ANDROID_HOME` unset (must be set to `%LOCALAPPDATA%\Android\Sdk`).
- Expo Go currently supports "SDK 57(latest)" [DIGEST https://expo.dev/go]; but the widget needs a development build (`npx expo install expo-dev-client && npx expo run:android`) [DIGEST https://docs.expo.dev/develop/development-builds/introduction/].
- New Architecture is mandatory from SDK 55 [DIGEST WebSearch of expo.dev/changelog/sdk-55]; react-native-android-widget reportedly supports the new architecture since 0.16.0 [FETCHED-TODAY WebSearch summary; not a primary source] - verify in W1 by building.

## Key version table (npm, 2026-09-03) [FETCHED-TODAY]
expo 57.0.19; react-native 0.87.1; react-native-android-widget 0.22.1 (2026-08-17); @react-native-ml-kit/text-recognition 2.0.0; tesseract.js 7.0.0; expo-secure-store 57.0.3; expo-local-authentication 57.0.2; expo-camera 57.0.4; expo-image-picker 57.0.15; expo-sqlite 57.0.2; expo-notifications 57.0.16; expo-print 57.0.1; expo-sharing 57.0.17; expo-file-system 57.0.6; expo-router 57.0.18; @react-navigation/native 7.3.18; express 5.2.1; pg 8.23.0; jsonwebtoken 9.0.3; bcryptjs 3.0.3; zod 4.5.4; jest-expo 57.0.5; supertest 7.2.2; zustand 5.0.15; @tanstack/react-query 5.102.8; drizzle-orm 0.45.2; prisma 8.0.0-rc.12 (use drizzle, prisma is RC).

## Gaps not covered
- IPAC System file on Google Classroom (formula, whether self-assessment counts) not accessible.
- Samsung One UI 8 third-party lock-screen widget support: only secondary press sources; Samsung's own page could not be fetched (redirect loop).
- react-native-android-widget New Architecture support: secondary search summary only; GitHub releases page returned unreliable dates.
- Exact Gemini free-tier RPM/RPD numbers not on the public page (AI Studio dashboard only).
- Whether the instructor accepts an emulator-only lock-screen widget demo as satisfying "Lock Screen" - ask the instructor in W1.
- Encryption-at-rest documentation for Neon/Supabase not fetched.
- Whether the 7 Oct demo room has projector + Wi-Fi + USB access for scrcpy.
