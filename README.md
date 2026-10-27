# GoTravelNha API

The backend behind **api.gotravelnha.com**, written in NestJS. It serves:

- the public site, www.gotravelnha.com (`../web`)
- the back office, admin.gotravelnha.com (`../admin`)
- the mobile app

Sign-in goes through Keycloak at **auth.gotravelnha.com** (`../keycloak`).

| | |
| --- | --- |
| Stack | NestJS 11 (Express), Prisma 5 on PostgreSQL, `jose`, Swagger, Terminus |
| API docs | `/docs` (Swagger UI) and `/docs-json` (OpenAPI document) |
| Health | `/health` (process and database), `/health/live` (process only) |
| Routes | `/api/...`, the same paths the site used before the split |

## Getting started

Requirements: Node 22 (or newer) and PostgreSQL. The video studio also needs FFmpeg.

```bash
cp .env.example .env   # fill in DATABASE_URL, SESSION_PASSWORD, OIDC_CLIENT_SECRET, ...
npm install            # also runs prisma generate
npx prisma migrate deploy
npm run dev            # http://localhost:3002, docs at http://localhost:3002/docs
```

Run it alongside the frontends:

| App | Folder | Local URL | Points at the API with |
| --- | --- | --- | --- |
| API | `backend/` | http://localhost:3002 | — |
| Site | `web/` | http://localhost:3000 | `NUXT_PUBLIC_API_BASE=http://localhost:3002` |
| Admin | `admin/` | http://localhost:3001 | `NUXT_PUBLIC_API_BASE=http://localhost:3002` |

For local development, set these in `backend/.env`:

- `NUXT_PUBLIC_SITE_URL=http://localhost:3000`
- `NUXT_PUBLIC_ADMIN_URL=http://localhost:3001`
- `NUXT_PUBLIC_API_URL=http://localhost:3002`
- `SESSION_COOKIE_DOMAIN` left empty. Browsers share localhost cookies across ports, so www and admin on localhost share the session.

Keycloak already allows `http://localhost:3002/auth/callback` as a redirect URI.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Nest in watch mode |
| `npm run build` / `npm start` | Compile to `dist/` / run `dist/main.js` |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | `node:test` suites in `test/`. Database suites skip unless `COMMUNITY_TEST_DATABASE_URL` points at a disposable database. |
| `npm run users:migrate-to-keycloak` | Copy existing users into Keycloak. Dry run by default; add `-- --apply`, then `-- --apply --send-emails`. |
| `npm run video:install` | Install Playwright Chromium for the video studio (once per host) |
| `npm run video:all` | Run the video pipeline from the command line (also `video:capture`, `video:voice`, `video:render`, `video:validate`) |
| `npm run video:typecheck` | Typecheck the video pipeline |
| `npm run vercel-build` | `prisma generate`, then `prisma migrate deploy`, then `nest build` (Vercel's build step) |

## Project layout

```
src/
  main.ts                  bootstrap: cookies, body parsers, CORS, Swagger
  app.module.ts            every module; OriginCheckMiddleware on all routes
  config/                  useRuntimeConfig(): all settings read from the environment
  common/                  guards (@Auth, @AdminOnly, @CurrentUser), HTTP helpers, errors, rate limits, zod → OpenAPI
  prisma/                  PrismaModule / PrismaService and the single PrismaClient
  auth/                    Keycloak login, session cookie, Bearer tokens, Keycloak admin API
  health/  seo/            /health, /sitemap.xml, /robots.txt
  shared/                  utils and types also used by ../web (keep the copies in sync)
  <domain>/                one module per API area (affiliate, community, planner, trips, travellers, users, admin, videos, ...)
    <domain>.module.ts  <domain>.controller.ts  <domain>.service.ts
    handlers/              one file per route
    services/              the area's business logic
  videos/studio/           video pipeline (ESM, run with tsx; not part of the Nest build)
test/                      tests
scripts/                   command-line tools
prisma/                    schema, migrations, seed
api/index.js               Vercel function entry (wraps dist/main.js)
public/                    intentionally empty (see "Deploying to Vercel")
```

`CLAUDE.md` explains how to add a route.

## Authentication

- **Browsers (www, admin).**
  1. The frontend sends the user to `GET /auth/login?redirect=<www or admin URL>`. Add `&register=1` to open the sign-up page, or `&ref=CODE` to pass a referral code.
  2. Keycloak redirects back to `/auth/callback`. The API sets an encrypted, HttpOnly `gotravelnha_session` cookie on `SESSION_COOKIE_DOMAIN`, then returns the user to the frontend.
  3. `GET /auth/logout?redirect=...` ends both the API session and the Keycloak session.
- **Mobile and other clients.** Send `Authorization: Bearer <Keycloak access token>`. The token audience must be `gotravelnha-api`.
- **Roles.** `@Auth()` requires a signed-in user. `@AdminOnly()` requires the Keycloak `admin` role, which comes from the `gotravelnha-admins` group. Every `/api/admin/*` route is admin-only.
- **Passwords** live only in Keycloak. The API changes them through the `iam-admin` service account.
- **CORS** gives credentialed access to the site and admin origins only. Writes with any other `Origin` header get a 403.

## Environment variables

`.env.example` lists every variable with comments.

**Required**

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `DIRECT_URL` | Direct, non-pooled connection, used by `prisma migrate deploy` |
| `SESSION_PASSWORD` | 32+ random characters (`openssl rand -hex 32`) |
| `SESSION_COOKIE_DOMAIN` | `.gotravelnha.com` in production, empty locally |
| `NUXT_PUBLIC_API_URL` | `https://api.gotravelnha.com` (the OIDC redirect URI is `<this>/auth/callback`) |
| `NUXT_PUBLIC_SITE_URL` | `https://www.gotravelnha.com` |
| `NUXT_PUBLIC_ADMIN_URL` | `https://admin.gotravelnha.com` |
| `OIDC_CLIENT_SECRET` | `GTN_WEB_CLIENT_SECRET` from the Keycloak deployment |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | `IAM_ADMIN_CLIENT_SECRET` from the Keycloak deployment |
| `ANTHROPIC_API_KEY` | Trip planner |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Contact form and newsletter emails |

**Usually set**

| Variable | Notes |
| --- | --- |
| `ANTHROPIC_WORKSPACE_ID` | Only when the API key is not scoped to one workspace |
| `SELF_BOOKING_NOTIFY_EMAIL` | Inbox for contact messages (defaults to `SMTP_USER`) |
| `AFFILIATE_POSTBACK_SECRET` | 16+ characters. Partner conversion postbacks are off without it. |
| `NUXT_PUBLIC_ENABLE_COMMUNITY` | `true` to turn on the community API. Use the same value as `web/`. |
| `NUXT_PUBLIC_SUPPORT_EMAIL` | Support address shown in emails |

**Optional**: the defaults are already the production values.

- `OIDC_ISSUER` (default `https://auth.gotravelnha.com/realms/gotravelnha`), `OIDC_CLIENT_ID` (default `gotravelnha-web`), `OIDC_AUDIENCE` (default `gotravelnha-api`), `KEYCLOAK_ADMIN_CLIENT_ID` (default `iam-admin`)
- `CORS_ORIGINS`
- `TRIP_ALLIANCE_ID`, `TRIP_SID`, `TRIP_BASE_URL`, `KLOOK_AD_ID`
- `KLOOK_AFFILIATE_FLIGHT_REDIRECT_URL`, `KLOOK_AFFILIATE_HOTEL_REDIRECT_URL`, `KLOOK_AFFILIATE_ATTRACTION_REDIRECT_URL`
- `SMTP_SECURE`, `SMTP_REQUIRE_STARTTLS`, `SMTP_TLS_MIN_VERSION`, `SMTP_TLS_CIPHERS`

**Video studio only** (long-running hosts): `VIDEO_STUDIO_DATA_DIR`, plus one TTS provider: ElevenLabs (`ELEVENLABS_*`), Google (`GOOGLE_TTS_*`) or Azure (`AZURE_*`).

`NODE_ENV` and `VERCEL` are set by the platform. In production, `NODE_ENV=production` makes the session cookie `Secure`.

## Deploying to Vercel

The whole app runs as one serverless function. `api/index.js` boots Nest once per instance, and `vercel.json` rewrites every path to it.

1. Create a Vercel project with **Root Directory** `backend`, the **Other** framework preset and Node 22.
2. Add the environment variables above for **Production** (and Preview, if you use it). They are needed at build time too, because the build runs the database migrations.
3. Point `api.gotravelnha.com` at the project.
4. In Keycloak, run `../keycloak/scripts/configure-subdomains.sh` once so the client accepts `https://api.gotravelnha.com/auth/callback`.

`vercel.json` sets the region to `sin1` and the function timeout to 120 seconds. Vercel caps the timeout at your plan's maximum; the trip planner can take up to a minute.

> `public/` must stay empty. Vercel serves static files before it applies rewrites, so pointing `outputDirectory` at the project root would publish the source code.

Limits on Vercel:

- **Video rendering is refused (503).** Render on a long-running host or locally.
- **Rate limits are per instance.** The per-IP limits (contact, analytics, planner) apply to each function instance separately, so they are not a global cap.
- **Cold starts.** The first request on a new instance boots the app.

### Other hosts

Any Node host works: `npm ci && npm run build && npm start`. It listens on `PORT` (default 3002). For video rendering, the host also needs:

- FFmpeg, from the OS packages
- Chromium: `npm run video:install`
- a writable `VIDEO_STUDIO_DATA_DIR`
- one TTS key

## Video studio

admin → **Videos** renders 60-second YouTube Shorts from real footage of www. The pipeline is: Playwright capture → TTS narration → FFmpeg render → validation.

- **Pipeline:** `src/videos/studio`. Its `README.md` covers the config format and the validation rules.
- **API:** `/api/admin/videos/*` (admin only, documented in Swagger). It handles readiness checks, configs, jobs (start, follow, cancel) and file streaming.
- **Jobs:** one at a time, with each stage in its own child process.
- **Data:** `VIDEO_STUDIO_DATA_DIR` (default `storage/video-studio`, not committed) holds `output/`, `configs/` and `jobs/`.

## Database

Prisma schema and migrations live in `prisma/`. This project owns them; `../web` and `../admin` have no database access.

```bash
npx prisma migrate dev --name <change>   # create a migration locally
npx prisma migrate deploy                 # apply migrations (runs in vercel-build)
```

Tables from retired features (AttractionsSG, scrapers) are still in the schema and the database. Dropping them needs its own migration.
