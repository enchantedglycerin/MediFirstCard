# MediFirstCard — Backend, Database, Storage, Auth, Security & Hosting (research as of 2026-09-03)

Scope: Node.js/Express REST API + PostgreSQL as promised in the proposal (Section 5/6: "RESTful API via Node.js / Express", "PostgreSQL / Firebase Firestore ... Encryption at Rest & in Transit", password-protected in-depth data). Zero budget, Windows 10 dev machine (build 19045), Android-first, live demo 7 Oct 2026, repo due 11 Oct 2026. Implementation will be executed by an AI coding agent from this plan, so everything below is pinned to exact packages/versions/commands.

Verification legend: [F] = fetched from a primary source in this run (2026-09-03); [D] = fetched by the previous research agent (digest evidence); [U] = unverified / inferred.

---

## 0. TL;DR — ONE recommended stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 22 LTS (22.23.x) or 24 LTS | Both LTS as of Aug 2026 [D] https://nodejs.org/en/about/previous-releases ; `file-type` needs >=22, vitest needs ^20/^22/>=24 |
| Language | TypeScript 5.9.x + `tsx` 4.23.13 for dev, `esbuild` 0.28.2 bundle for prod | tsx engines >=18 [D] https://registry.npmjs.org/tsx/latest |
| HTTP framework | Express 5.2.1 (`@types/express` 5.0.6) | Express 5 is `latest` on npm, Node >=18, async errors auto-forwarded [D] https://registry.npmjs.org/express/latest , https://expressjs.com/en/guide/migrating-5.html |
| ORM | Drizzle ORM 0.45.2 + drizzle-kit 0.31.10 + `pg` 8.23.0 | Stable `latest`; Prisma's `prisma` `latest` dist-tag currently points at 8.0.0-rc.12 (Node >=22.18) while `@prisma/client` latest is 7.10.0 — churn risk for a 5-week project [D] |
| Database | Supabase Postgres (Free: 500 MB, 2 projects, 1 GB storage) — alt: Neon Free (0.5 GB, scale-to-zero 5 min) | Supabase is explicitly named in the course brief; one project gives Postgres + object storage + AES-256 at rest + TLS [D] https://supabase.com/pricing , https://supabase.com/security |
| Object storage | Supabase Storage private bucket, server-issued signed upload (2 h) / signed download URLs | No credit card; R2 requires "checkout flow to add an R2 subscription" [F]; Firebase Storage needs Blaze since 2026-02-03 [D] |
| Auth | Custom: `argon2` 0.45.1 (Argon2id) + `jose` 6.2.10 JWT (access 15 min / refresh 30 d, rotated, hashed in DB) + in-app PIN/biometric gate (`expo-local-authentication`, `expo-secure-store`) | Fully explainable to graders; matches proposal "password-based security system". Alt: Better Auth 1.7.2 (Express + Expo plugins) |
| Security middleware | `helmet` 8.3.0, `cors` 2.8.6, `express-rate-limit` 8.7.0, `zod` 4.5.4, `multer` 2.3.0 + `file-type` 22.0.2 | all verified on npm [D] |
| Field encryption | Node `crypto.createCipheriv('aes-256-gcm')`, 12-byte IV, tag stored | at-rest managed AES-256 + app-level AES-256-GCM for sensitive text fields; avoid pgcrypto (keys travel in SQL) [D] |
| API hosting | Render Free Web Service (spins down after 15 min idle; ~1 min spin-up; 750 h/month) kept awake by UptimeRobot 5-min pings (Free: 50 monitors, no card) | only stay-free option without credit card; DO NOT use Render Free Postgres (expires after 30 days) [F][D] |
| Public emergency page | Server-rendered HTML route `GET /e/:token` in the same Express app (EJS 3.1.10) + `qrcode` 1.5.4 | zero extra hosting; QR points to `https://<render-app>.onrender.com/e/<token>` |
| Push | Expo Push API via `expo-server-sdk` 7.2.0 (free, 600/s) | needs Android dev build + FCM V1 creds (Expo Go can't receive push since SDK 53) [D] |
| Alerts | Resend (3,000/mo, 100/day) email + LINE Messaging API (300 free msgs/mo in Thailand) | LINE Notify ended 2025-03-31 [D]; Twilio trial can only SMS sign-up country + 5 verified numbers [F] |
| Tests / CI | vitest 4.1.11 + supertest 7.2.2; GitHub Actions with `postgres` service container (free for public repos) | [D] |
| Docs | `zod-openapi` 6.0.2 → OpenAPI 3.1 JSON, served with `@scalar/express-api-reference` 0.10.17 (or `swagger-ui-express` 5.0.1) | [D] |
| Local dev | Docker Desktop (free for education; needs Win10 22H2 build 19045 = this machine) + `postgres:18-alpine` | [D] https://docs.docker.com/desktop/setup/install/windows-install/ |
| Demo fallback | Local API + Docker Postgres + `cloudflared tunnel --url http://localhost:3000` (no account, random trycloudflare.com URL) or ngrok free static domain; or phone hotspot + LAN IP | [D] |

Total recurring cost: **$0** (see cost table §12).

---

## 1. Express 5 vs 4, TypeScript setup

- Express `latest` = **5.2.1**, engines `node >= 18` [D] https://registry.npmjs.org/express/latest
- Migration guide facts [D] https://expressjs.com/en/guide/migrating-5.html :
  - "Request middleware and handlers that return rejected promises are now handled by forwarding the rejected value as an Error to the error handling middleware" → no `express-async-errors` needed.
  - Wildcards must be named: `/*` → `/*splat`; optional params `:file{.:ext}`.
  - `req.query` is a getter; default query parser is "simple".
  - `res.status(201).json(...)` order enforced; `app.del()` removed; `res.sendfile` → `res.sendFile`.
  - `express.static` `dotfiles` defaults to `"ignore"`.
  - Codemod: `npx codemod@latest @expressjs/v5-migration-recipe`.
- Decision: **Express 5.2.1**. It is what `npm i express` installs today; every listed middleware supports it (`express-rate-limit` peer `express >= 4.11` [D]; `swagger-ui-express` peer `>=4.0.0 || >=5.0.0-beta` [D]; Better Auth documents `/api/auth/*splat` for v5 [D]).
- TypeScript: `typescript` 5.9.x (Prisma docs recommend 5.9.x [D]). `@types/express` latest **5.0.6** [D]. Dev runner `tsx` **4.23.13** [D]. Bundler `esbuild` **0.28.2** [D].
- Env loading: Node's built-in `node --env-file=.env` (added v20.6.0, stable since v22.21.0 / v24.10.0) and `--env-file-if-exists` (v22.9.0) [D] https://nodejs.org/api/cli.html → no `dotenv` needed in production start script.

Setup commands:
```bash
mkdir medifirstcard-api && cd medifirstcard-api
npm init -y
npm i express@5.2.1 helmet@8.3.0 cors@2.8.6 express-rate-limit@8.7.0 zod@4.5.4 pino@10.3.1 pino-http argon2@0.45.1 jose@6.2.10 drizzle-orm@0.45.2 pg@8.23.0 multer@2.3.0 file-type@22.0.2 @supabase/supabase-js@2.114.0 qrcode@1.5.4 ejs@3.1.10 expo-server-sdk@7.2.0 resend zod-openapi@6.0.2 @scalar/express-api-reference@0.10.17
npm i -D typescript@5.9 tsx@4.23.13 esbuild@0.28.2 @types/express@5.0.6 @types/node@22 @types/pg @types/multer @types/qrcode drizzle-kit@0.31.10 vitest@4.1.11 supertest@7.2.2 @types/supertest
npx tsc --init --target es2022 --module nodenext --moduleResolution nodenext --strict --outDir dist --rootDir src
```
`package.json` scripts:
```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file-if-exists=.env src/server.ts",
    "build": "esbuild src/server.ts --bundle --platform=node --target=node22 --format=esm --outfile=dist/server.mjs --packages=external",
    "start": "node --env-file-if-exists=.env dist/server.mjs",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  }
}
```
Note: `file-type` is ESM-only (`"type":"module"`, node >=22) [D] → the API project must be ESM (`"type": "module"`), which is why `format=esm` above.

---

## 2. Prisma vs Drizzle (decision: Drizzle)

Evidence:
- `prisma` npm `latest` dist-tag = **8.0.0-rc.12** (engines node >=22.18.0), `prev` = 7.10.0 [D] https://registry.npmjs.org/-/package/prisma/dist-tags ; `@prisma/client` `latest` = **7.10.0** [D]. GitHub releases: 7.10.0 (Aug 25) is the newest stable; many 8.0.0-rc.x pre-releases in late Aug [D] https://github.com/prisma/prisma/releases . A plain `npm i prisma @prisma/client` today yields mismatched majors (CLI 8-rc, client 7) — a real footgun for an AI agent.
- Prisma 7 breaking changes [D] https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7 : Rust-free client, mandatory driver adapter `@prisma/adapter-pg` (latest 7.10.0 [D]), `prisma.config.ts` with `datasource.url = env("DATABASE_URL")`, generator `provider = "prisma-client"` with output path, min Node 20.19, env vars no longer auto-loaded, middleware API removed.
- Drizzle ORM `latest` = **0.45.2**; a `1.0.0-rc.4` also exists under the `rc` tag [D]; drizzle-kit latest **0.31.10** [D]. Drizzle docs quick start [D] https://orm.drizzle.team/docs/get-started/postgresql-new (docs currently show `@rc` installs; pin `latest` 0.45.2 for stability).

Drizzle setup (exact):
```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```
```ts
// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? undefined : { rejectUnauthorized: false },
  max: 5,
});
export const db = drizzle(pool);
```
Run: `npx drizzle-kit generate` → `npx drizzle-kit migrate` (or `npx drizzle-kit push` for prototyping) [D].

If the team insists on Prisma (more tutorials): pin explicitly `npm i prisma@7.10.0 @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg`, and use `prisma.config.ts` + `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` [F] https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/postgresql .

---

## 3. Free managed Postgres — current limits (2026-09-03)

| Provider | Free limits | Sleep / expiry | Card? | Source |
|---|---|---|---|---|
| **Supabase** | 2 active projects; 500 MB DB (shared CPU, 500 MB RAM); 1 GB file storage; 5 GB egress; 50k MAU auth; 500k edge fn invocations; Pro from $25/mo | "Free projects are paused after 1 week of inactivity" (manual restore from dashboard) | No | [D] https://supabase.com/pricing |
| **Neon** | 100 projects/org; 0.5 GB storage/project; 100 CU-hours/project/month; up to 2 CU; 5 GB egress; 60k MAU Neon Auth; "permanent (not a trial)" | Compute scales to zero after 5 min inactivity; Free users cannot disable it; reactivates "within a few hundred milliseconds" | No ("no credit card required") | [D] https://neon.com/pricing , https://neon.com/docs/introduction/scale-to-zero |
| **Render Postgres** | 1 GB storage, only ONE free DB per workspace | "Free Render Postgres databases expire 30 days after creation", deleted after 14-day grace | not stated | [F][D] https://render.com/docs/free |
| **Railway** | Free plan: $1 credit/month, 0.5 GB RAM, 0.5 GB volume; Trial: one-time $5 for 30 days, then reverts to Free; volumes deleted 30 days after trial credits expire | usage-metered — $1/mo is not enough for an always-on DB+API | No (trial) | [D] https://railway.com/pricing , https://docs.railway.com/reference/pricing/free-trial |
| **Aiven** | 1 VM, 1 CPU, 1 GB RAM, 1 GB storage; "no time limitations"; no region choice, no connection pooling | may be shut down "if unused for an extended period" | not stated | [D] https://aiven.io/pricing |
| **Xata** | Xata Lite retired 2026-02-28; current Xata is a self-hosted/open-source Postgres platform (scale-to-zero ~10 s wake) — no hosted free tier found | n/a | n/a | [D] https://xata.io/pricing , https://github.com/xataio/client-ts |
| **Koyeb Postgres** | "Free 5h", 0.25 vCPU, 1 GB RAM — but Koyeb compute has no free plan (Pro $29/mo) and Koyeb joined Mistral AI (Feb 2026) | | | [D] https://www.koyeb.com/pricing |
| Firebase Firestore (Spark) | 1 GiB, 50k reads/20k writes/20k deletes per day; Auth 50k MAU | — | No | [D] https://firebase.google.com/pricing |

Decision: **Supabase** primary (Postgres + Storage + named in course brief). Mitigate 1-week pause with a keepalive: the same UptimeRobot monitor that keeps Render awake hits `GET /health/db` (runs `SELECT 1`) every 5 minutes, plus a GitHub Actions `schedule` cron every 6 h as backup, so the DB is never idle for a week. **Neon** is the drop-in alternative if the team prefers no pause risk (cold start of a few hundred ms is invisible to users); with Neon, keep Supabase only for Storage.

Connection: use the Supabase "Session pooler" URI (IPv4-friendly) from the Connect dialog; `pg` with `ssl: { rejectUnauthorized: false }` unless you embed the Supabase CA. Managed encryption: Supabase — "All customer data is encrypted at rest with AES-256 and in transit via TLS." and "Supabase is SOC 2 Type 2 compliant" / HIPAA with BAA [D] https://supabase.com/security . Neon — "All customer and sensitive data is encrypted using AES-256 encryption at rest", "TLS 1.2/1.3", SOC2/ISO27001 [D] https://neon.com/docs/security/security-overview . These sentences satisfy the proposal's "Encryption at Rest & in Transit" claim; cite them in the README.

---

## 4. API hosting — stays free AND awake for the live demo

| Host | Free tier (2026-09) | Awake? | Card? | Verdict |
|---|---|---|---|---|
| **Render Free Web Service** | 750 instance-hours/workspace/month; "spins down a Free web service that goes 15 minutes without receiving any inbound traffic"; spin-up "takes about one minute" | Sleeps; keep awake with external pinger (UptimeRobot Free: 50 monitors, 5-min interval, "No credit card required!") | Not stated in docs | **Recommended** [F][D] https://render.com/docs/free , https://uptimerobot.com/pricing/ |
| Cloudflare Workers Free | 100,000 req/day, 10 ms CPU/invocation; Hyperdrive included on Free (100k DB queries/day); KV 1 GB | Always on, no cold start | No | **Stretch**: Express can run via `httpServerHandler` from `cloudflare:node` (`nodejs_compat`, compat date later than 2025-08-15; `enable_nodejs_http_server_modules` auto-on from 2025-09-01) [F][D] https://blog.cloudflare.com/bringing-node-js-http-servers-to-cloudflare-workers/ , https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/ , https://developers.cloudflare.com/hyperdrive/platform/pricing/ . Caveat: native `argon2`/`bcrypt` don't run in Workers → use `@noble/hashes` argon2 or WebCrypto PBKDF2; 10 ms CPU limit makes Argon2id marginal. Hono 4.13.5 [D] is the idiomatic framework there (`npm create hono@latest`, cloudflare-workers template, `npm run dev` → :8787, `npm run deploy`, bindings via `c.env`) [D] https://hono.dev/docs/getting-started/cloudflare-workers |
| Vercel Hobby | "The Hobby plan is free and aimed at developers with personal projects" [D] https://vercel.com/docs/plans/hobby ; serverless functions | Cold starts; Express must be wrapped as a function | No | acceptable for the public QR page, awkward for uploads/long DB pools |
| Railway | $1/mo Free credit; $5 one-time 30-day trial | Metered; will run out mid-semester | No | not for 5 weeks |
| Fly.io | No free tier; "All organizations (except for Linked Organizations) require a credit card on file"; cheapest VM ~$2.02/mo | | Yes | out [D] https://fly.io/docs/about/pricing/ |
| Koyeb | No free compute plan (Pro $29/mo incl. $10 compute) | | | out [D] https://www.koyeb.com/pricing |
| Google Cloud Run | Always-free 2M req/mo, 360k GB-s, 180k vCPU-s, 1 GB egress — but "A Google Cloud billing account is required to access the Google Cloud Free Tier" and trial needs a credit card | Scale-to-zero cold start | Yes | out unless someone has a card [D] https://docs.cloud.google.com/free/docs/free-cloud-features |
| Netlify Free | 300 credits/mo (bandwidth 20 credits/GB, compute 10 credits/GB-hour, production deploys 15 credits each, 2 credits per 10k requests) | functions only | not stated | out (credit model too small) [F] https://www.netlify.com/pricing/ |

Render deployment steps (Node/Express) [F][D] https://render.com/docs/deploy-node-express-app :
1. Push repo to GitHub (public → also unlocks free unlimited GitHub Actions minutes).
2. Render dashboard → New → Web Service → connect repo, root dir `api/`, Runtime Node, Build Command `npm ci && npm run build && npm run db:migrate`, Start Command `npm start`, Instance type **Free**.
3. Env vars: `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENC_KEY` (32-byte base64), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `LINE_CHANNEL_ACCESS_TOKEN`, `PUBLIC_BASE_URL=https://medifirstcard-api.onrender.com`, `NODE_VERSION=22`.
4. Listen on `process.env.PORT` and host `0.0.0.0`. Health check path `/health`.
5. Optional `render.yaml` at repo root:
```yaml
services:
  - type: web
    name: medifirstcard-api
    runtime: node
    plan: free
    rootDir: api
    buildCommand: npm ci && npm run build && npm run db:migrate
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: DATABASE_URL
        sync: false
```
6. UptimeRobot: HTTP monitor on `https://medifirstcard-api.onrender.com/health/db`, interval 5 min. 750 free hours > 744 hours in a 31-day month, so one always-pinged service fits.
7. On demo day: ping the API 10 minutes before the slot from a phone browser anyway.

---

## 5. Object storage for scans

| Service | Free | Signed URLs | Card / gotcha | Source |
|---|---|---|---|---|
| **Supabase Storage** | 1 GB, 5 GB egress; Free plan global file-size cap 50 MB ("For Free projects, the limit can't exceed 50 MB"), per-bucket lower limits allowed | `createSignedUploadUrl(path, {upsert})` — "Signed upload URLs can be used to upload files to the bucket without further authentication. They are valid for 2 hours."; `uploadToSignedUrl(path, token, fileBody, fileOptions)`; `createSignedUrl(path, expiresIn, {download, transform})` | No card; project pauses after 1 week idle (mitigated in §3) | [F] https://raw.githubusercontent.com/supabase/supabase-js/master/packages/core/storage-js/src/packages/StorageFileApi.ts , [D] https://supabase.com/docs/guides/storage/uploads/file-limits , https://supabase.com/docs/guides/storage/serving/downloads |
| Cloudflare R2 | 10 GB-month storage, 1M Class A, 10M Class B ops/month, free egress | S3 presigned GET/PUT via `@aws-sdk/client-s3` 3.1125.0 + `@aws-sdk/s3-request-presigner` 3.1125.0, endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`, max expiry 7 days | "You need a Cloudflare account with an R2 subscription ... Complete the checkout flow to add an R2 subscription" → payment method needed | [F] https://developers.cloudflare.com/r2/get-started/ , [D] https://developers.cloudflare.com/r2/pricing/ , https://developers.cloudflare.com/r2/api/s3/presigned-urls/ |
| Firebase Storage | 5 GB-months, 100 GB/mo download on new buckets | Firebase SDK rules / signed URLs via Admin SDK | "you must upgrade to the pay-as-you-go Blaze pricing plan ... This requirement went into effect starting February 03, 2026" | [D] https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 |
| AWS S3 | New accounts since 2025-07-15 get up to $200 credits, free plan 6 months | presigned | card + 6-month free-plan window | [D] https://aws.amazon.com/s3/pricing/ |

Design: bucket `records` (private). Flow: app → `POST /records` (metadata, zod-validated) → server calls `supabase.storage.from('records').createSignedUploadUrl('<userId>/<recordId>.jpg')` with the **service_role** key (never shipped to the app) → returns `{signedUrl, token, path}` → app uploads with `uploadToSignedUrl` or plain `PUT` → app calls `POST /records/:id/confirm` → server verifies object exists (list), records `size`, `mime`, `sha256`. Reads: `GET /records/:id/url` → `createSignedUrl(path, 300)`. Optional server-side path for small files: `multer` memoryStorage (10 MB limit) + `file-type` magic-byte check (`fileTypeFromBuffer`) restricted to `image/jpeg`, `image/png`, `application/pdf`, then `supabase.storage.from('records').upload(path, buffer, {contentType})`.

---

## 6. Auth

### 6a. Password hashing
- `argon2` npm **0.45.1**, node >=16.17, prebuilt binaries via `node-gyp-build`/`prebuildify` [D] https://registry.npmjs.org/argon2/latest → installs on Windows/Render without a compiler.
- `bcrypt` **6.0.0**, node >=18, prebuilt [D] https://registry.npmjs.org/bcrypt/latest . 72-byte input limit ("bcrypt has a maximum length input length of 72 bytes") [D].
- OWASP Argon2id parameters: "m=19456 (19 MiB), t=2, p=1" (equivalent set incl. m=47104,t=1); bcrypt "minimum of 10" [D] https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Code: `await argon2.hash(pw, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })`, `argon2.verify(hash, pw)`.

### 6b. Tokens
- `jose` **6.2.10** [D] https://registry.npmjs.org/jose/latest (Web-standard, no native deps, also works on Workers) — `new SignJWT({sub, scope}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('15m').sign(secret)`; refresh token = random 32 bytes (base64url), store `sha256(token)` in `refresh_tokens(user_id, token_hash, expires_at, revoked_at, replaced_by)`; rotate on every `/auth/refresh`; reuse detection revokes the family. Alt `jsonwebtoken` 9.0.3 [D].
- App stores tokens in `expo-secure-store` (Android: "SharedPreferences, encrypted with Android's Keystore system"; iOS keychain; keep values under ~2048 bytes) [D] https://docs.expo.dev/versions/latest/sdk/securestore/

### 6c. In-app PIN / biometric gate ("Security & Privacy Access" in the proposal)
- `expo-local-authentication` (SDK 57 docs) — `hasHardwareAsync()`, `isEnrolledAsync()`, `authenticateAsync({promptMessage, disableDeviceFallback, cancelLabel})`; Android permissions `USE_BIOMETRIC`/`USE_FINGERPRINT` auto-added; works in Expo Go on Android; iOS FaceID not in Expo Go [D] https://docs.expo.dev/versions/latest/sdk/local-authentication/
- PIN: 6-digit, hashed with argon2id **server-side** (`POST /auth/pin/verify` returns a short-lived "vault" JWT with `scope: 'vault'`, 5 min) so in-depth records endpoints require `scope=vault`; locally cache a `requireAuthentication: true` SecureStore item to allow biometric unlock (SecureStore `requireAuthentication` "is not supported in Expo Go when biometric authentication is available" [D]). Fallback to password.

### 6d. Managed alternatives (if the team wants less code)
- **Better Auth 1.7.2** [D] https://registry.npmjs.org/better-auth/latest : Express integration `app.all('/api/auth/*splat', toNodeHandler(auth))` mounted **before** `express.json()` ("Mount the Better Auth handler before body-parsing middleware such as express.json()") [D] https://www.better-auth.com/docs/integrations/express ; Expo plugin `npm install better-auth @better-auth/expo expo-secure-store expo-network`, server `plugins:[expo()]`, `trustedOrigins:['medifirstcard://']`, client `expoClient({scheme, storage: SecureStore})`, email+password supported [D] https://www.better-auth.com/docs/integrations/expo ; adapters Prisma/Drizzle/Kysely/MongoDB/pg Pool; schema via `npx auth@latest generate` / `npx auth@latest migrate`; tables user, session, account, verification [F] https://www.better-auth.com/docs/concepts/database
- **Supabase Auth** (50k MAU free): `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill` [D] https://supabase.com/docs/guides/auth/quickstarts/react-native — but then the Express API must verify Supabase JWTs (JWKS via jose), which blurs the "custom backend" story.
- **Neon Auth** = managed Better Auth (beta, on Better Auth 1.4.18), 60k MAU, no RN docs [D] https://neon.com/docs/auth/overview
- Firebase Auth 50k MAU free [D] — fine, but Firebase Storage/Functions now need Blaze.

Recommendation: custom argon2+jose (graders can read every line; "Technical understanding" rubric). Better Auth is the upgrade if time is short.

---

## 7. Encryption at rest, in transit, field-level

- In transit: Render terminates TLS on `*.onrender.com`; Supabase/Neon require TLS to Postgres (Neon: "requires that all connections use SSL/TLS") [D]. App → API only over HTTPS; on demo-day tunnel, cloudflared/ngrok also give HTTPS.
- At rest (managed): Supabase AES-256, Neon AES-256 [D] (quotes in §3).
- App-level field encryption (defense in depth, satisfies "highly secure encrypted cloud database"): Node `crypto.createCipheriv('aes-256-gcm', key, iv)`; `cipher.getAuthTag()` after `final()`; `decipher.setAuthTag(tag)` and `final()` throws on tamper [D] https://nodejs.org/api/crypto.html . Use 12-byte random IV (NIST SP 800-38D), store `base64(iv||tag||ciphertext)` in a `text` column, key = 32-byte `FIELD_ENC_KEY` env (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Encrypt: conditions notes, allergies notes, medication list, emergency-contact phone, document notes/OCR text. Keep blood type & filterable fields plain (needed for lock-screen/emergency view).
- pgcrypto `pgp_sym_encrypt`/`pgp_sym_decrypt` exists, but "all the data and passwords move between pgcrypto and client applications in clear text" and keys appear in SQL/logs [D] https://www.postgresql.org/docs/current/pgcrypto.html → not recommended; mention as a considered alternative in README.
- Passwords: argon2id (never encrypted, only hashed). Tokens: SHA-256 hashed at rest.

```ts
// src/crypto/fieldEncryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
const key = Buffer.from(process.env.FIELD_ENC_KEY!, 'base64'); // 32 bytes
export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
export function decryptField(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  const d = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
```

---

## 8. Emergency-view tokens, clinician share links, revocation, audit log

Schema (Drizzle, `src/db/schema.ts`):
```
users(id uuid pk, email text unique, password_hash, pin_hash, locale, created_at)
emergency_profiles(user_id pk fk, full_name, blood_type, conditions_enc, allergies_enc, medications_enc,
  emergency_contact_name, emergency_contact_phone_enc,
  lock_screen_fields jsonb  /* user-chosen subset {bloodType:true, allergies:true, contact:false} — proposal's privacy contingency */,
  updated_at)
medical_records(id uuid pk, user_id fk, kind enum(certificate|lab|prescription|other), title, issued_at date, facility,
  storage_path, mime, size_bytes, sha256, notes_enc, created_at, updated_at)
share_links(id uuid pk, user_id fk, token_hash text unique, scope enum(emergency|records), fields jsonb,
  expires_at, revoked_at, max_views int, view_count int, access_code_hash, created_at)
share_access_log(id bigserial, share_link_id fk, accessed_at, ip inet, user_agent, outcome enum(ok|expired|revoked|not_found))
refresh_tokens(id, user_id, token_hash, expires_at, revoked_at, replaced_by)
push_tokens(user_id, expo_token unique, platform, updated_at)
audit_log(id bigserial, user_id, action, entity, entity_id, at, meta jsonb)
```
- Emergency token: `randomBytes(24).toString('base64url')` → URL `https://<api>/e/<token>`; DB stores SHA-256 only; `scope=emergency`, `expires_at=null` (valid until revoked; it is the card printed/QR'd on the lock screen) but `fields` limited to the user's `lock_screen_fields` selection. Clinician share: `scope=records`, `expires_at = now()+24h`, `max_views=10`, optional 4-digit access code (argon2-hashed).
- `GET /e/:token` = server-rendered HTML (EJS 3.1.10 [D]) with big fonts, Thai/English toggle, red/amber/green status labels; no JS required; rate-limited 30/min/IP; every hit inserted into `share_access_log`; `POST /share-links/:id/revoke` sets `revoked_at`; app screen "Access log" lists views (Category 5 role-based/consent + Category 1 history/timestamps). Also `GET /e/:token.json` for the app/clinician mode.
- QR: `qrcode` 1.5.4 [D] `QRCode.toDataURL(url)` on server (PNG for lock-screen widget image at `GET /e/:token/qr.png`) or `react-native-qrcode-svg` in app.

---

## 9. Hardening middleware, validation, uploads

- `helmet` 8.3.0 (node >=18) [D]; `cors` 2.8.6 [D] with allowlist; allow `*` only for the public `/e/*` HTML.
- `express-rate-limit` 8.7.0 [D]: global 300/15 min; `/auth/login` 10/15 min per IP+email; `/e/:token` 30/min.
- `zod` 4.5.4 [D] schemas in `packages/shared` (used by both RN app and API); a `validate(schema)` middleware parsing `body/query/params` (rubric "Basic data validation": missing value, invalid range e.g. blood type enum, duplicate record by sha256).
- Uploads: `multer` 2.3.0 (node >=10.16) [D] `memoryStorage`, `limits:{fileSize: 10*1024*1024, files:1}`, then `file-type` 22.0.2 `fileTypeFromBuffer` allowlist; reject mismatched extension.
- Logging: `pino` 10.3.1 [D] + `pino-http`; redact `req.headers.authorization`, `password`, `pin`.
- Error handler: single `app.use((err, req, res, next) => ...)` mapping ZodError→400, JOSEError→401, else 500 with request id; never leak stack in production.
- Health: `GET /health` (200 ok, version, uptime), `GET /health/db` (`SELECT 1`).

---

## 10. Notifications & automation (Category 2 "Notification or automated alert via backend/workflow")

- **Expo Push**: endpoint `https://exp.host/--/api/v2/push/send`, up to 100 messages/request, 600 notifications/s/project; "There is no cost associated with sending notifications through Expo push notification service." [D] https://docs.expo.dev/push-notifications/sending-notifications/ , https://docs.expo.dev/push-notifications/faq/ ; server lib `expo-server-sdk` 7.2.0 [D]. Constraint: "Push notifications (remote notifications) functionality provided by expo-notifications is unavailable in Expo Go on Android from SDK 53" → EAS/local **development build** + FCM V1 service-account credentials uploaded to EAS [D] https://docs.expo.dev/versions/latest/sdk/notifications/ , https://docs.expo.dev/push-notifications/push-notifications-setup/ . Use case: "Your emergency card was viewed at 14:32" alert when `/e/:token` is hit; medication-expiry reminder.
- **Resend** (email): Free 3,000/mo, 100/day, 3 domains; `npm install resend`; test sender `onboarding@resend.dev` ("Use a verified domain in the from address for production. onboarding@resend.dev is for testing only.") [D] https://resend.com/pricing , https://resend.com/docs/send-with-nodejs . Without a verified domain Resend only delivers to the account owner's email [U]. Use for: share-link created / card viewed notifications to the user's email. No domain purchase needed for the demo (send to team email).
- **LINE Messaging API** (Thailand-relevant): LINE Notify ended "2025年3月31日" [D] https://notify-bot.line.me/closing-announce ; Thailand LINE OA Free plan = 300 messages/month (Basic 1,280 THB/15k, Pro 1,780 THB/35k) [D] https://lineforbusiness.com/th/service/line-oa-features/broadcast-message ; push/multicast/broadcast count, reply messages don't [D] https://developers.line.biz/en/docs/messaging-api/pricing/ . Flow: user adds the OA, webhook captures `userId`, server `POST https://api.line.me/v2/bot/message/push` with channel access token → "card viewed" to LINE. 300/mo is ample for a demo.
- **Twilio SMS**: trial gives product units (e.g. 100 SMS) but "You can only send to verified phone numbers (up to 5 per account)" and "SMS and voice are limited to your sign-up country"; "Trial ends 30 days after sign-up." [F] https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account ; Thailand requires pre-registered alphanumeric Sender ID, "Long code international: Not Supported", blocking enforced since 2025-10-06 [D] https://www.twilio.com/en-us/guidelines/th/sms → **skip SMS**. ThaiBulkSMS offers a free trial of SMS/OTP API (credit count not published) [D] https://www.thaibulksms.com/developer/ — optional.
- **n8n** (self-hosted Community Edition free; cloud has no permanent free plan, Starter 20€/mo) [D] https://n8n.io/pricing/ ; run locally `docker volume create n8n_data && docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n` [U — docs page 404'd; long-standing README quick start]. Use: API `POST`s a webhook on `share_link.viewed` → n8n sends Resend email + LINE push + appends to Google Sheet. Local-only during demo.
- **Node-RED** 4.x requires Node >=18 [D] https://nodered.org/docs/faq/node-versions ; `npm install -g node-red`, run `node-red`, port 1880 [D] https://nodered.org/docs/getting-started/local . Alternative to n8n.
- Cron for keepalive/reminders: cron-job.org "absolutely free", up to once per minute [D] https://cron-job.org/en/ ; or GitHub Actions `schedule`.

---

## 11. Local dev on Windows, tests, CI, docs

- Docker Desktop: "Windows 10 64-bit: Enterprise, Pro, or Education version 22H2 (build 19045)", 8 GB RAM, free for personal/education use [D] https://docs.docker.com/desktop/setup/install/windows-install/ . The dev machine is 10.0.19045 Pro → OK (needs WSL 2: `wsl --install`).
- `docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:18-alpine      # tag updated 2026-08-15 on Docker Hub [D]
    environment:
      POSTGRES_USER: medi
      POSTGRES_PASSWORD: medi
      POSTGRES_DB: medifirstcard
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U medi"], interval: 5s, retries: 10 }
  api:
    build: ./api
    env_file: ./api/.env
    environment:
      DATABASE_URL: postgres://medi:medi@db:5432/medifirstcard
      PGSSL: disable
    ports: ["3000:3000"]
    depends_on: { db: { condition: service_healthy } }
volumes: { pgdata: {} }
```
PostgreSQL 18 is current (18.6; EOL 2030-11-14); 17.11 also supported [D] https://www.postgresql.org/support/versioning/ . Supabase runs PG 17 — pin `postgres:17-alpine` locally for parity if desired.
- Tests: `vitest` 4.1.11 (node ^20||^22||>=24) + `supertest` 7.2.2 [D]. Pattern: `src/app.ts` exports the Express app (no `listen`), `src/server.ts` listens; tests `request(app).post('/auth/register')`. Unit tests for `crypto/fieldEncryption.ts`, `auth/tokens.ts`, zod schemas; integration tests against Docker/CI Postgres.
- GitHub Actions: "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners"; private: 2,000 min/mo, 500 MB artifacts [D] https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions . Workflow uses the documented service container [D] https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers :
```yaml
name: api-ci
on:
  push:
  pull_request:
  schedule:
    - cron: '0 */6 * * *'
jobs:
  test:
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18-alpine
        env: { POSTGRES_PASSWORD: postgres }
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres
      PGSSL: disable
      JWT_SECRET: test-secret-test-secret-test-secret
      FIELD_ENC_KEY: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: api/package-lock.json }
      - run: npm ci
        working-directory: api
      - run: npm run lint && npm run db:migrate && npm test
        working-directory: api
  keepalive:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS https://medifirstcard-api.onrender.com/health/db
```
- OpenAPI: `zod-openapi` 6.0.2 (peer zod ^4) [D] builds the document from the same zod schemas; serve JSON at `/openapi.json` and UI at `/docs` with `@scalar/express-api-reference` 0.10.17 [D] (`app.use('/docs', apiReference({ url: '/openapi.json' }))`) or `swagger-ui-express` 5.0.1 [D]. Screenshot `/docs` for the README.

---

## 12. $0 cost table

| Item | Plan | Monthly cost | Limit that matters | Card? |
|---|---|---|---|---|
| Supabase (Postgres + Storage) | Free | $0 | 500 MB DB, 1 GB files, 50 MB/file, pause after 7 idle days | No |
| Neon (alt DB) | Free | $0 | 0.5 GB, 100 CU-h, 5-min scale-to-zero | No |
| Render Web Service | Free | $0 | 750 h/mo, 15-min spin-down | not stated |
| UptimeRobot | Free | $0 | 50 monitors @ 5 min | No |
| GitHub (public repo) + Actions | Free | $0 | unlimited minutes on public repos | No |
| Expo Push service | — | $0 | 600/s | No |
| Resend | Free | $0 | 3,000/mo, 100/day | not stated |
| LINE Official Account (TH) | Free | $0 | 300 push msgs/mo | No |
| cloudflared Quick Tunnel | — | $0 | 200 concurrent req, random URL | No account |
| ngrok (alt) | Free | $0 | 3 endpoints, 1 static dev domain, 1 GB, interstitial page | not stated |
| Docker Desktop | Personal/Education | $0 | — | No |
| Cloudflare Workers (stretch) | Free | $0 | 100k req/day, 10 ms CPU | No |
| **Total** | | **$0** | | |

Explicitly excluded because they need a card or cost money: Fly.io (card required), Cloud Run (billing account required), Koyeb (Pro $29), Railway beyond $1/mo, Cloudflare R2 (subscription checkout), Firebase Storage (Blaze since 2026-02-03), Twilio SMS to Thailand, n8n Cloud, Vercel Pro.

---

## 13. Repository / folder structure (monorepo)

```
MediFirstCard/
  README.md                 # rubric items: architecture diagram, install, run, screenshots, video, limitations, roles, responsible-use statement
  docs/architecture.md      # mermaid: RN app -> Express API (Render) -> Supabase Postgres + Storage; Expo Push; LINE/Resend; Android widget
  docker-compose.yml
  .github/workflows/api-ci.yml
  app/                      # Expo React Native app (separate research topic)
  packages/shared/          # zod schemas + TS types shared by app and api
  api/
    package.json  tsconfig.json  drizzle.config.ts  .env.example  Dockerfile  render.yaml
    drizzle/                # generated SQL migrations (committed)
    src/
      server.ts             # app.listen(PORT, '0.0.0.0')
      app.ts                # express(), helmet, cors, pino-http, json({limit:'1mb'}), routes, error handler
      config/env.ts         # zod-validated process.env
      db/index.ts  db/schema.ts  db/seed.ts
      crypto/fieldEncryption.ts   # AES-256-GCM encrypt/decrypt
      auth/password.ts (argon2)  auth/tokens.ts (jose)  auth/middleware.ts (requireAuth, requireScope('vault'))
      middleware/validate.ts  middleware/rateLimit.ts  middleware/errorHandler.ts
      modules/
        auth/        # POST register, login, refresh, logout, pin/set, pin/verify
        profile/     # GET/PUT /me/emergency-profile, PUT /me/lock-screen-fields, GET /me/emergency-card
        records/     # POST /records (signed upload), POST /records/:id/confirm, GET /records, GET /records/:id/url, DELETE /records/:id
        share/       # POST /share-links, GET /share-links, POST /share-links/:id/revoke, GET /share-links/:id/log
        public/      # GET /e/:token (HTML), GET /e/:token.json, GET /e/:token/qr.png
        push/        # POST /push-tokens ; internal notify()
        export/      # GET /me/export.json (Category 1 export)
        health/      # GET /health, GET /health/db
      integrations/supabaseStorage.ts  resend.ts  line.ts  expoPush.ts  n8nWebhook.ts
      openapi.ts             # zod-openapi document + /docs
      views/emergency.ejs    # public emergency card (TH/EN, large font, status colours)
    test/  *.test.ts (vitest + supertest)
```

Widget data path (ties to the proposal): `GET /me/emergency-card` returns exactly the fields chosen in `lock_screen_fields` plus the emergency URL/QR PNG; the app caches it locally and the Android App Widget reads that cache (widgets should not depend on network), refreshed on app open and via push "profile updated".

Dockerfile (api/):
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["npm","start"]
```

---

## 14. Demo-day runbook (7 Oct 2026)

Primary: Render API + Supabase. T-30 min: open `https://medifirstcard-api.onrender.com/health/db` from a phone; confirm UptimeRobot shows "Up"; confirm Supabase project not paused.
Fallback A (venue Wi-Fi blocks Render or Render is slow): laptop runs `docker compose up -d db && npm run dev` (data pre-seeded with the demo user via `db/seed.ts`), then `cloudflared tunnel --url http://localhost:3000` → paste the printed `https://<random>.trycloudflare.com` into the app's Settings → "API base URL" screen (build this screen; graders also benefit). Quick Tunnels: no account, no domain, 200 concurrent request cap, no SSE, "intended for testing and development only" [D] https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/ . Install: 64-bit MSI/exe from https://github.com/cloudflare/cloudflared/releases/latest (docs list exe/MSI; "Instances of cloudflared do not automatically update on Windows") [F] https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/ ; `winget install --id Cloudflare.cloudflared` also works [U].
Fallback B: ngrok free — 3 endpoints, one assigned static dev domain, 1 GB, "Interstitial page on HTTP/S endpoints" (send header `ngrok-skip-browser-warning: 1` from the app's fetch; browsers see a click-through page) [D] https://ngrok.com/pricing .
Fallback C (no internet at all): phone hotspot; laptop joins; API on `http://<laptop-LAN-IP>:3000`; Android dev build needs cleartext allowed for http; Supabase Storage unreachable → records upload shows a friendly error and queues locally (the rubric asks to demonstrate "Handling some errors or limitations").
Always: 3-minute backup video + screenshots on a USB stick.

---

## 15. Rubric mapping for this layer

- Category 1 Data & Storage: Supabase cloud DB; structured schema with timestamps/metadata; validation (zod, duplicate detection by sha256, refresh-token reuse detection); history/audit log; export JSON of the card.
- Category 2 API/Backend/Automation: custom Express backend (genuine integration), REST API, automated alert via Expo Push + Resend/LINE (genuine integration), n8n webhook workflow (optional).
- Category 5: role-based public clinician view vs patient app; consent screen = lock-screen field chooser; accessibility large-font emergency page.
- Testing/error handling/stability: vitest+supertest in CI, health checks, rate limits, structured errors.
- Responsible use: README disclaimer; encryption statements quoted from Supabase/Neon; token revocation + access log.

---

## 16. Key evidence quotes (verbatim, for the README/limitations section)

- Render: "Render spins down a Free web service that goes 15 minutes without receiving any inbound traffic." / "This process takes about one minute." / "Render grants 750 Free instance hours to each workspace per calendar month." / "Free Render Postgres databases expire 30 days after creation." / "Only one Free Render Postgres database can be active for any given workspace." [F] https://render.com/docs/free
- Supabase: "Free projects are paused after 1 week of inactivity." (pricing) ; "All customer data is encrypted at rest with AES-256 and in transit via TLS." (security) ; "For Free projects, the limit can't exceed 50 MB." (file limits) ; "Signed upload URLs can be used to upload files to the bucket without further authentication. They are valid for 2 hours." (storage-js source) [D][F]
- Neon: "Neon compute scales to zero after an inactive period of 5 minutes." / "Free plan users cannot disable it." / "reactivates automatically within a few hundred milliseconds." [D]
- Cloudflare R2: "You need a Cloudflare account with an R2 subscription ... Complete the checkout flow to add an R2 subscription to your account." [F] https://developers.cloudflare.com/r2/get-started/
- Firebase: "you must upgrade to the pay-as-you-go Blaze pricing plan ... This requirement went into effect starting February 03, 2026." [D]
- Expo: "There is no cost associated with sending notifications through Expo push notification service." / "Push notifications (remote notifications) functionality provided by expo-notifications is unavailable in Expo Go on Android from SDK 53." [D]
- Twilio: "You can only send to verified phone numbers (up to 5 per account)." / "SMS and voice are limited to your sign-up country" [F]
- Cloudflare Workers + Express: `import { httpServerHandler } from 'cloudflare:node'; ... app.listen(3000); export default httpServerHandler({ port: 3000 });` requires `nodejs_compat` "with a compatibility date later than 08-15-2025" (blog 2025-09-08) [F]
- Docker Desktop: "Windows 10 64-bit: Enterprise, Pro, or Education version 22H2 (build 19045)." [D]
- Node: v22 "Jod" LTS, v24 "Krypton" LTS, v26 Current (as of Aug 2026) [D]
- Prisma: `prisma` dist-tags `latest: 8.0.0-rc.12`, `prev: 7.10.0`; `@prisma/client` `latest: 7.10.0` [D]

## 17. Gaps not closed
- Supabase project-pausing doc page 404'd twice; restore time/limits on Free are unverified (pricing page sentence is the only source).
- Render Free RAM/CPU (historically 512 MB / 0.1 CPU) and credit-card requirement not stated on the docs page fetched.
- Koyeb: pricing page shows no free compute plan; the official announcement of free-plan removal was not fetched (Koyeb blog/plans pages 404, TechCrunch fetch blocked by the previous agent's session limit).
- n8n Docker quick-start page 404'd; command taken from long-standing README convention.
- ngrok free static-domain command page 404'd; `ngrok http --url=<your-dev-domain> 3000` is from memory.
- Resend "only send to your own email without a verified domain" rule not quoted from docs.
- Vercel Hobby function limits page was too large for extraction; only the "free ... personal projects" sentence is verified.
- Whether Render free web services require a payment method was not confirmed from docs.
- Supabase Session-pooler port/URI format not fetched; take it from the project's Connect dialog.
