# Manual test plan (run on the phone each week; PM logs results)

Mark each: PASS / FAIL / N/A, with the date and device. Automated tests live in `packages/shared/test` and `apps/api/test`.

## Phase 0 + W2 backend (verified 2026-09-03, no Docker/cloud needed)
- [x] `npm install` at repo root completes with no errors.
- [x] `npm run shared:test` passes (11 tests).
- [x] `npm run api:test` passes (16 tests: auth, profile, emergency card, records, mock extraction).
- [x] `npm run api:dev` serves `GET /health` `{ ok: true }`; live flow (register → profile → card+QR → record → extract) runs over HTTP on PGlite.
- [ ] Re-run on the team's machines after moving the repo to `C:\mfc`.

## W2 (identity, profile, card, lock screen) — fill after W2
- [ ] Fresh install → consent → account → PIN → profile editable.
- [ ] Emergency card readable on the locked phone (notification + wallpaper).
- [ ] Toggle a lock-screen field → preview and notification update within 1 s.
- [ ] Second phone scans the QR → public page loads from Render.
- [ ] Airplane mode → PIN unlock → card and cached profile open.
- [ ] Empty allergy form / future DOB / bad Thai ID → field errors.
- [ ] Wrong PIN ×5 → lock-out.

## W3 (archive, AI) — fill after W3
- [ ] Photograph a synthetic certificate → encrypted row in Supabase.
- [ ] Extraction review: smudged sample → red field; blurry → 422; same photo → 409.
- [ ] Provider down (invalid key) + fixture from gallery → mock chip → manual entry.
- [ ] Offline record queued and synced within 10 s of reconnect.

## W4 (sharing, release) — fill after W4
- [ ] Clinician link opens on a laptop; revoke → "expired".
- [ ] Card-viewed alert appears in the notifications screen; API log shows the email.
- [ ] Release APK installs and runs against the hosted API.
