# Deploy the API to Render (free tier)

Everything is prepared in `render.yaml`. Render only needs the repository and the secrets; the whole thing is about five clicks and one paste session. No credit card.

## Once: create the service

1. Sign up at https://render.com (GitHub login is simplest).
2. Dashboard → **New** → **Blueprint** → connect the `enchantedglycerin/MediFirstCard` repository → Render finds `render.yaml` and shows the service `medifirstcard-api`.
3. It asks for the values marked `sync: false`. Open `apps/api/.env` on the lead developer's machine and paste, one by one:

   | Render asks for | Paste from `.env` | Notes |
   |---|---|---|
   | `DATABASE_URL` | line `DATABASE_URL=` | the Supabase Session-pooler URI with the real password |
   | `JWT_SECRET` | line `JWT_SECRET=` | or generate a new one; existing logins will just re-login |
   | `FIELD_ENC_KEY` | line `FIELD_ENC_KEY=` | **must be identical** — it already encrypted the rows in Supabase |
   | `SUPABASE_URL` | line `SUPABASE_URL=` | |
   | `SUPABASE_SERVICE_ROLE_KEY` | line `SUPABASE_SERVICE_ROLE_KEY=` | |
   | `GEMINI_API_KEY` | line `GEMINI_API_KEY=` | |
   | `TYPHOON_API_KEY` | line `TYPHOON_API_KEY=` | |
   | `RESEND_API_KEY`, `ALERT_EMAIL_TO` | leave blank | in-app alerts work without e-mail |

4. **Apply**. The first build takes 5–8 minutes (npm install + esbuild bundle + migrations against Supabase). The log ends with `listening` and the health check turns green.
5. Open `https://medifirstcard-api.onrender.com/health` — expect `"storageProvider":"supabase"`, `"extractProvider":"gemini"`, `"encryption":"on"`. If Render had to add a suffix to the name, use the URL shown at the top of the service page instead.

## Point the app at it

The release app (v1.0.1+) already defaults to `https://medifirstcard-api.onrender.com`. If Render gave the service a different URL, set it once on the phone: **More → Developer → Server URL** → paste → Save. Older builds (v1.0.0) default to `http://localhost:3000` and need the Server URL set either way.

## Every later change

Push to `main` → Render rebuilds and redeploys automatically (`autoDeploy: true`). Migrations run during the build, so schema changes deploy with the code.

## Behaviour you should expect

- **Cold start.** The free instance sleeps after 15 minutes without traffic; the first request then takes 30–60 s. Two keep-alive pings prevent that: a GitHub Actions cron (`.github/workflows/keepalive.yml`, every 10 min, but GitHub may delay or skip scheduled runs on quiet repos) and a `pg_cron` job inside the Supabase database (`keep-render-warm`, every 10 min, `net.http_get` to `/health`; see the Supabase SQL editor → `select * from cron.job`). If you ever remove both, open `/health` a minute before the demo, or run the API on the laptop as the fallback.
- **Logs.** Render → service → Logs. Provider failures appear as `[extract] …` lines without secrets; the app shows the example result with a warning chip instead of failing.
- **Rotating a key.** Change it under service → Environment → Save; Render restarts the service. Never rotate `FIELD_ENC_KEY` after data exists.
- **HTTPS everywhere.** With the API on Render the app talks HTTPS, so the cleartext-HTTP flag in `apps/mobile/app.json` (`expo-build-properties`) is only needed for laptop-hosted demos and can be removed later.

## If you would rather not click

Give the lead developer a Render API key (Account Settings → API Keys) and the service can be created and configured from the command line with the same `render.yaml`.
