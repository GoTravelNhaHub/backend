# backend/ — GoTravelNha API (api.gotravelnha.com)

NestJS 11 (Express), Prisma `^5.19` on PostgreSQL, Swagger (`@nestjs/swagger`), health checks (`@nestjs/terminus`), `jose` for Keycloak tokens. Split out of `../web` on 2026-10-27, then moved from Nitro to NestJS. Route paths are unchanged (`/api/...`), so web, admin and mobile did not change.

```bash
npm run dev          # nest start --watch, :3002
npm run build        # nest build → dist/
npm start            # node dist/main.js
npm run typecheck    # tsc --noEmit (strict)
npm test             # tsx --test test/*.test.ts
npx prisma generate  # after schema.prisma changes
npm run users:migrate-to-keycloak   # dry run; add -- --apply [--send-emails]
npm run video:install  # once per host: Playwright Chromium for the video studio
npm run video:typecheck             # the studio pipeline is checked separately from the Nest app
```

| URL | What |
| --- | --- |
| `/docs` | Swagger UI. `/docs-json` is the OpenAPI document. |
| `/health` | Readiness: process + database (`SELECT 1`), 503 when the DB is down. |
| `/health/live` | Liveness, no dependencies. |

Vercel: `api/index.js` wraps the compiled app (`dist/main.js`); `vercel.json` rewrites every path to it. `public/` is deliberately empty: Vercel serves static files before rewrites, so it must never point at the project root. The build runs `npm run vercel-build` (`prisma generate` && `prisma migrate deploy` && `nest build`). Region `sin1`. This project owns the database migrations; `../web` and `../admin` have no database access.

## Layout

```
src/
  main.ts                   bootstrap: cookies, body parsers (incl. the text/plain click beacon), CORS, Swagger
  app.module.ts             imports every module; OriginCheckMiddleware on all routes
  config/runtime-config.ts  useRuntimeConfig(): all env-derived settings in one object
  common/                   http.ts (HttpEvent + request/response helpers), http-error.ts (createError), openapi.ts
                            (zod → OpenAPI), auth/ (guards, @Auth, @AdminOnly, @CurrentUser), middleware/,
                            allowed-origins, rate-limit, utils/ (email, browser, safe-url, attribution, activity-limits)
  prisma/                   PrismaModule, PrismaService, prisma.client.ts (the one PrismaClient)
  auth/                     Keycloak login (/auth/login|callback|logout), /api/auth/me|logout, session, oidc, keycloak-admin
  health/                   /health
  seo/                      /sitemap.xml (www proxies it), /robots.txt
  shared/utils, shared/types  helpers shared with the frontends (copies of ../web/utils and ../web/types; keep in sync)
  <domain>/                 one module per API area:
    <domain>.module.ts
    <domain>.controller.ts  (admin has one controller per sub-area: admin-bookings.controller.ts, ...)
    <domain>.service.ts
    handlers/*.ts           one file per route
    services/*.ts           the domain's business logic (affiliate links, community, planner, ...)
test/                       node:test suites (npm test); DB suites skip without COMMUNITY_TEST_DATABASE_URL
scripts/                    CLIs run with tsx (Keycloak user migration)
prisma/                     schema, migrations, seed
api/index.js                Vercel function entry only (Vercel requires the api/ folder); wraps dist/main.js
```

### Adding or changing a route

1. Put the logic in `src/<domain>/handlers/<name>.ts` as `export async function <name>(event: HttpEvent)`. Read input with `readBody(event)`, `getQuery(event)`, `getRouterParam(event, 'id')` from `common/http`. Throw `createError({ statusCode, message })`. Return a value and it becomes JSON (a string becomes text, null becomes 204).
2. Add a method to `<domain>.service.ts` that calls it.
3. Add the route to `<domain>.controller.ts`: `@Get('api/...')` (full path, no global prefix), `@ApiOperation`, `@ApiParam`/`@ApiQuery`, `@ApiBody` (prefer `zodBodySchema(Schema)` when the handler validates with zod), and `@Auth()` or `@AdminOnly()`. One controller method per HTTP verb; stacking `@Get` and `@Post` on one method registers only one.
4. Register a new module in `app.module.ts`.

Errors return `{ statusCode, message }`; the frontends read `error.data.message`.

## Video studio (`src/videos`)

YouTube Shorts recorded from www (Playwright capture → TTS narration → FFmpeg render → validation), moved here from `web/tools/video-studio` on 2026-10-27.

- `src/videos/studio/`: the pipeline. ESM TypeScript (its own `package.json` with `"type": "module"` and its own `tsconfig.json`), excluded from the Nest build, run with `tsx`. `README.md` there documents the config format and validation rules.
- `VideosModule` (`/api/admin/videos/*`, admin only): status, configs (list/get/put), jobs (start/list/get/cancel), and `file?path=output/...` (Range-capable streaming). `VideoJobsService` runs one job at a time, one child process per stage, and keeps job records in `<data>/jobs`.
- Data: `VIDEO_STUDIO_DATA_DIR` (default `storage/video-studio`, gitignored) holds `output/`, `configs/` (seeded from `studio/config`) and `jobs/`.
- Needs a long-running host with `ffmpeg`/`ffprobe`, Chromium (`npm run video:install`) and one TTS key (ElevenLabs, Google or Azure). On Vercel, starting a job returns 503.
- CLI still works from `backend/`: `npm run video:all` (or `video:capture|voice|render|validate`, with `VIDEO_CONFIG=config/<file>.json`).

## Auth

- Keycloak at `OIDC_ISSUER` (auth.gotravelnha.com, realm `gotravelnha`), confidential client `gotravelnha-web`, PKCE.
- Browsers: `/auth/login?redirect=` → Keycloak → `/auth/callback` → encrypted `gotravelnha_session` cookie (jose A256GCM, key from `SESSION_PASSWORD`) on `SESSION_COOKIE_DOMAIN` (`.gotravelnha.com`), shared by www, admin and api. `/auth/logout?redirect=` ends both sessions. Redirect targets must be in `CORS_ORIGINS` / site / admin URLs.
- Mobile and other clients: `Authorization: Bearer <access token>`, `aud` `gotravelnha-api`.
- The global `AuthContextGuard` resolves the user once per request. `@Auth()` requires sign-in; `@AdminOnly()` requires the Keycloak `admin` role (group `gotravelnha-admins`); all `/api/admin/*` and `GET/POST /api/users` are admin-only. `requireUser(event.req)` / `requireAdmin(event.req)` inside handlers still work.
- Users are matched by `User.keycloakId` (token `sub`), first time by verified email; `role` follows the token. Passwords live only in Keycloak (`src/auth/keycloak-admin.ts`, service account `iam-admin`). `User.password` is legacy and unused.
- CORS allows credentials for the site and admin origins only. `OriginCheckMiddleware` refuses writes with a foreign `Origin`; partner postbacks send none. Community routes also pass `CommunityEnabledGuard` (feature flag + `Sec-Fetch-Site`).

## Removed on 2026-10-27

AttractionsSG (catalogue, crawler, supplier automation), ticket checkout, Stripe, customer bookings, admin bookings and all scraper/crawl endpoints. cheerio and stripe are no longer dependencies; Playwright is back only for the video studio's capture stage. Their tables (`AttractionsgEvent`, `AttractionsgBooking`, `ScraperSource`, `ScraperJob`, `TripScrapedData`, ...) are still in `prisma/schema.prisma` and the database; dropping them needs a migration and an explicit decision. Plans saved with `sg:` catalogue ids resolve as "No longer listed".

## Gotchas

- Prisma loads `backend/.env` by itself when the client is created, even if you pass other env vars; override values explicitly when testing.

## Do not

- Run destructive database changes unless asked.
- Add a second Prisma client or a second auth scheme.
