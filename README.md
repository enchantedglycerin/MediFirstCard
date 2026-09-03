# MediFirstCard

[![api-ci](https://github.com/enchantedglycerin/MediFirstCard/actions/workflows/api-ci.yml/badge.svg)](../../actions)

> **Educational prototype (course 040333215 Smart Technology 2026).** Not a medical device. It does not diagnose, treat, cure, or prevent any condition. Emergency information is self-reported and unverified.

An Android emergency health ID card and medical-records archive: a user-chosen emergency card pinned to the lock screen, tap-to-call emergency contacts and Thai EMS (1669), a PIN-protected archive of scanned medical certificates with AI extraction and human review, and QR/link sharing for rescuers and clinicians.

> ภาษาไทย: แอปบัตรฉุกเฉินและคลังเอกสารทางการแพทย์บนแอนดรอยด์ แสดงข้อมูลฉุกเฉินบนหน้าจอล็อก โทรหาผู้ติดต่อฉุกเฉินและ 1669 ได้ทันที เก็บเอกสารหลังรหัส PIN พร้อมดึงข้อมูลด้วย AI และแชร์ผ่าน QR/ลิงก์ ต้นแบบเพื่อการศึกษาเท่านั้น

## Group members and their roles
See [CONTRIBUTORS.md](CONTRIBUTORS.md). Implementation is AI-assisted (Claude), directed and reviewed by the lead developer; each member commits the files they own.

## Problem and motivation
In an emergency the first responders cannot see blood type, allergies, chronic conditions or an emergency contact because the phone is locked; medical certificates are scattered on paper and lost when changing hospitals. MediFirstCard keeps a patient-held, encrypted copy and shows a chosen subset on the lock screen.

## Main features
Everything below runs today on a real Android phone against the local API (verified 2026-09-04, screenshots in `docs/screenshots/`).

- **Emergency card** — name, blood group (Rh-negative flagged), allergies in red, conditions, medications and emergency contacts, in "first 60 seconds" order. **Call 1669** button and a **Call** button on every contact (opens the dialer with the number).
- **Lock-screen card** — the same card pinned as a non-dismissable notification on a public-visibility channel, so it is readable without unlocking. The user chooses which fields are exposed and is warned about exposure.
- **Emergency profile** — identity, date of birth, sex, blood group, no-known-allergy flag, medical flags (blood thinners, insulin, pacemaker, dialysis, pregnancy), insurance scheme, notes; separate editors for **allergies, conditions, medications and emergency contacts** (Thai phone validation, informed-consent flag, call priority).
- **Rescuer surfaces** — QR code and public link (`/e/:token`) rendered as a dependency-free HTML page with tap-to-call, plus an in-app "preview as rescuer".
- **Document archive** — scan from camera or gallery → resize/JPEG → SHA-256 dedupe → upload → AI extraction → **red-field review** (every extracted field editable with a confidence chip; low-confidence fields highlighted) → record with kind, facility, doctor, licence, issue date and auto-computed validity; detail view with the original image; delete.
- **Share with a clinician** — temporary links (1 h / 24 h / 3 days) over selected documents, optional 4-digit passcode (5 failures revoke the link), view counts, revoke, access log; the public clinician page (`/s/:token`).
- **Alerts** — in-app notifications when the card or a shared link is viewed (or a link is revoked).
- **Privacy** — PDPA consent screen naming purposes, retention and the AI providers; withdraw consent (revokes all links); delete account (hard delete + storage cleanup + tombstone).
- **Security** — JWT access/refresh with rotation and reuse detection (single-flight refresh on the client), AES-256-GCM encryption of every health-content column, optional app PIN with fingerprint/face unlock, route guard.
- **Bilingual UI** — Thai and English, switchable in More; Buddhist-era dates in Thai.

## Advanced features (rubric)
| # | Feature | Category | Genuine integration | Code |
|---|---|---|---|---|
| A1 | Express 5 REST API with JWT auth, rotation + reuse detection | 2 API/Backend | Yes | `apps/api` |
| A2 | Postgres (PGlite locally / node-postgres on Render), field-level AES-256-GCM, SHA-256 dedupe, blob storage adapter | 1 Data & Storage | Yes | `apps/api/src/db`, `crypto`, `storage` |
| A3 | AI document extraction with per-field confidence and evidence, human-in-the-loop review (`mock` provider ships; Gemini + Typhoon adapters take API keys) | 4 AI/ML | Yes | `apps/api/src/modules/extract`, `apps/mobile/src/components/RecordReviewForm.tsx` |
| A4 | Card-viewed / share-viewed alert workflow (in-app; email stub) | 2 Automation | Yes | `apps/api/src/modules/alerts` |
| A5 | PDPA consent, lock-screen exposure warning, role-based views (owner / rescuer / clinician), status colours, elderly-friendly type | 5 Medical UI/UX | — | `apps/mobile` |
| A6 | Lock-screen pinned notification, tap-to-call, QR, PIN + biometrics | 3 Device / Sensors | — | `apps/mobile/src/lib/notifications.ts`, `phone.ts`, `pin.ts` |

## System architecture diagram
See [PLAN.md](PLAN.md) §4 (Mermaid). PNG to be added at `docs/architecture.png`.

## Installation steps
Prerequisites: Node 24 (`.nvmrc`), JDK 17 or 21, Android Studio with SDK Platform 36, `ANDROID_HOME` set. Windows first; macOS/Linux equivalents in each step.

```bash
git clone <repo> C:/mfc && cd C:/mfc   # short path avoids the Windows 260-char build failure
npm install
cp apps/api/.env.example apps/api/.env  # set FIELD_ENC_KEY and JWT_SECRET (see the file)
```

## How to run the app
**No cloud accounts, no Docker (dev / grader):** the API uses PGlite (embedded Postgres) when `DATABASE_URL` is unset, local-disk storage and the mock extractor.

```bash
npm run api:dev                          # Express on :3000; PGlite auto-migrates to apps/api/.data/pg
cd apps/mobile && npx expo run:android   # ALWAYS from apps/mobile (see docs/decisions.md); builds + installs the debug app
```
The debug app loads JavaScript from Metro. If it stays on the splash screen, Metro is not reachable: run `npx expo start` in `apps/mobile` from a normal terminal (not a CI shell) and, for a USB phone, `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8082 tcp:8081 && adb reverse tcp:3000 tcp:3000`. Set the API address under **More → Developer → Server URL** if the phone cannot use `localhost`.

Optional: `docker compose up -d db` and set `DATABASE_URL` for real Postgres 17. **Full cloud:** set Supabase, Render, Gemini and Typhoon values in `apps/api/.env`, deploy with `render.yaml`, and point the app's Server URL at it.

Verify the backend (no Docker, no accounts needed):
```bash
npm run shared:test      # 13 tests (card builder incl. tap-to-call phone, dates, validation)
npm run api:test         # 21 tests (auth, profile, card, records, extraction, public pages incl. tel: links, share, consent)
npm run mobile:typecheck # strict TypeScript over the whole app
```

## API / database / AI / sensor configuration
Env reference: [apps/api/.env.example](apps/api/.env.example). Extraction providers: `EXTRACT_PROVIDER=gemini|mock`, `OCR_PROVIDER=typhoon|none` (Gemini/Typhoon return 501 until keys are configured). **Sensors / device:** camera and photo picker (document capture), dialer intent (tap-to-call), notification channel with lock-screen visibility, fingerprint/face via `expo-local-authentication`; no IoT sensor. **What is encrypted:** every health-content text column (names, allergy substances/reactions, conditions, medications, contact names and phones, record titles/facility/doctor/licence, notes); enums, dates, blood group and IDs stay plain for filtering.

## Screenshots
`docs/screenshots/` (taken on a Samsung phone, Android 13): login, register, consent, contacts, emergency card with Call 1669 + contact call button, dialer opened by tap-to-call, the pinned lock-screen notification (cropped to the app's row), lock-screen settings, red-field review, records list, record detail, More.

## Demo video links
Intro video and full demo recording — to be added.

## Limitations
Lock-screen card is a pinned notification; how much of it shows on the lock screen depends on the phone's notification privacy setting. The Android 16 lock-screen widget hub is not targeted. iOS designed but not built. AI is assistive; the shipped provider is a deterministic mock until Gemini/Typhoon keys are added, and Thai handwriting is unverified; document images would go to Google Gemini and SCB 10X Typhoon (free tiers that may use inputs), so the demo uses synthetic documents only. Alert email is a stub. Single server encryption key; PIN lock-out signs the user out after 5 failures; not PDPA-audited; no guardian consent for minors; not connected to Mor Prom / Health Link; free-tier server sleeps. Cloud deployment (Supabase + Render) is scripted but not yet provisioned.

## Future development directions
Real Gemini + Typhoon extraction on the free tiers, Supabase Storage, Render deploy, iOS WidgetKit, edge-detecting scanner, vaccination module, push notifications, FHIR export to hospitals, NFC card.

## A statement on responsible use
MediFirstCard is a student educational prototype, not a medical device, and must not be used for diagnosis or treatment. Health data is sensitive personal data under the Thai PDPA: the app asks for explicit consent, states purposes and retention, names the AI providers, and lets the user withdraw consent and delete all data. Anything shown on the lock screen is readable by anyone holding the phone, so the user chooses each field and is warned before enabling it.
