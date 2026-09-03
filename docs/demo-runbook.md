# Demo runbook — Wed 7 Oct 2026

Everything the team does before, during and after the live demo. Written so that any member can run it; the lead developer is the fallback for every step.

## The day before

- [ ] Cloud path (preferred): the API is on Render (see `docs/deploy-render.md`); open `https://medifirstcard-api.onrender.com/health` to wake it and confirm `"ok":true`. The laptop steps below are the fallback if Render or the venue Wi-Fi misbehaves.


- [ ] Laptop: `git pull`, `npm install`, `npm run shared:test && npm run api:test` (all green), `npm run mobile:typecheck`.
- [ ] Laptop: `apps/api/.env` has `FIELD_ENC_KEY`, `JWT_SECRET`, and — if the keys exist — `EXTRACT_PROVIDER=gemini`, `GEMINI_API_KEY`, `OCR_PROVIDER=typhoon`, `TYPHOON_API_KEY`. Without keys the app uses the deterministic mock and says so on screen ("Example result").
- [ ] Laptop: find its Wi-Fi IPv4 (`ipconfig`), e.g. `192.168.1.20`. Set `PUBLIC_BASE_URL=http://192.168.1.20:3000` in `.env` so QR codes and share links open from the second phone.
- [ ] Demo phone (Android): install the **release** APK from `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (`adb install -r …`). It does not need Metro.
- [ ] Demo phone: More → Developer → Server URL = `http://192.168.1.20:3000` → Save. Both phones and the laptop on the same Wi-Fi (or the phone's hotspot with the laptop joined to it — the most reliable option in a classroom).
- [ ] Demo phone: copy `docs/samples/*.png` into Pictures (`adb push docs/samples/01-sick-leave-certificate.png /sdcard/Pictures/`), then open Gallery once so they are indexed.
- [ ] Demo phone: create the demo account, fill the profile (name, O Rh−, Penicillin severe, one contact with a real reachable number), turn on the lock-screen card, set a PIN you remember (write it on the runbook: `______`).
- [ ] Second phone: camera app that scans QR codes; same Wi-Fi.
- [ ] Laptop: `scrcpy` installed and tested with the demo phone (USB), window sized for the projector.
- [ ] Backup: `docs/screenshots/` open in a folder window; the demo recording (if made) on the desktop.
- [ ] Print `docs/handout.md` (4 pages) for the instructor.

## 30 minutes before

1. Laptop: `npm run api:dev` → wait for `listening on :3000`, open `http://localhost:3000/health` in a browser tab (leave it visible next to scrcpy: the API log is part of the demo).
2. Demo phone via USB → `scrcpy` → confirm the app opens, PIN unlocks, Home loads (this proves the Server URL works).
3. Second phone: open the camera, scan the QR on the Card tab once → the rescuer page must load. If it doesn't, the phones are on different networks: switch everyone to the phone hotspot.
4. Dismiss the pinned notification and turn the lock-screen card off, so you can turn it on live.

## Live demo (5 minutes) — who does what

| Step | Person | Taps | Say |
|---|---|---|---|
| 1 | PM | Open app → PIN → Home | "The app runs on a real phone against our API on this laptop. PIN protects the archive." |
| 2 | UX | Profile → Emergency contacts → Add: phone `12345` → error → correct number → Save; Allergies → add `Penicillin`, severe | "Validation follows the Thai phone format; the severe allergy will show in red." |
| 3 | DEV | Records → Scan → Gallery → `01-sick-leave-certificate.png` → watch the API log → review screen → fix the red licence field → Save | "Photo → hash → upload → AI. Red fields are the ones the model was unsure about; the user is the final editor." |
| 4 | DEV | Card tab → tap Call on the contact (dialer opens, cancel) → Lock-screen card → toggle on → Allow → pull down the shade | "One tap to call; the card is pinned so a rescuer reads it without unlocking." |
| 5 | UX / PM | Second phone scans the QR → rescuer page with Call buttons → demo phone More → Alerts shows "card viewed"; Share with a clinician → create link with passcode → open on the laptop → wrong passcode → right passcode → Revoke | "Everything a rescuer or doctor sees is chosen and revocable by the patient." |
| 6 | UX | Wrong PIN once; scan the same sample again → "already added"; stop the API (Ctrl-C) → tap Home → "cannot reach the server" → restart API | "Errors are explained, never a crash." |
| 7 | PM | More → Privacy (withdraw consent, delete account explained, not tapped) → close on the disclaimer | Limitations and responsible use, then Q&A. |

## If something breaks

- **App stays on splash / cannot reach server:** wrong Server URL or different network. Check `http://<laptop-ip>:3000/health` from the phone browser. Hotspot fallback.
- **AI call slow or 429:** say the free tier is rate-limited; the app retries three times, then shows the example result with a warning chip. Continue the demo — the review screen looks the same.
- **QR does not open on the second phone:** open the same link from the laptop browser instead (copy it from the Card tab via Share link).
- **Notification not on the lock screen:** the phone's lock-screen notification setting hides content; show the notification shade instead and say so.
- **Phone dies / scrcpy fails:** switch to the screenshots folder and the recording; keep the API log on screen to show the live backend.

## After the demo

- [ ] Record the live demo (screen recording of scrcpy + phone camera) and upload; add both video links to the README.
- [ ] Revoke all demo share links; delete the demo account from the phone (More → Privacy → Delete my account).
- [ ] Commit any fixes made on the day with the student identity; final push before Sun 11 Oct 23:59.

## Intro video shot list (≤ 3 minutes)

0:00 problem (locked phone, scattered certificates) · 0:20 users · 0:35 concept in one line · 0:55 features montage: card with Call 1669, lock-screen notification, scan → red-field review, share link · 1:35 architecture slide (Mermaid from README) · 2:00 the six advanced features · 2:30 limitations and the "prototype, not a medical device" statement. Thai narration, English subtitles from `docs/handout.md` page 4.
