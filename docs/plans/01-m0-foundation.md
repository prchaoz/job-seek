# M0 Foundation: task breakdown and implementation plan

## Context

`PLAN.md` describes a personal job-search agent (Hono TSX + HTMX, MongoDB, Agenda worker, Railway). The repository currently holds only `PLAN.md` and has no commits. The user asked to split the plan into tasks and start implementing. Agreed scope for this session: **M0 Foundation only** (section 15 of PLAN.md). M1+ stay as a documented backlog.

Decisions taken with the user:

| Concern | Decision |
|---|---|
| Package manager | **npm** (pnpm not installed). Deviation from PLAN.md; record it in the plan doc. |
| Queue | **Agenda 6.2.8 + `@agendajs/mongo-backend` 4.0.5** (published Nov 2026, peer `mongodb ^6 || ^7`). |
| Styling | **Tailwind CSS v4** via `@tailwindcss/cli`, compiled to a static stylesheet at build time. |
| Node | Node 26 is installed and is the current LTS line; Docker image uses `node:26-slim`. |

Environment facts that shape the tasks:
- Docker daemon is **down** locally. Testcontainers-based tests must skip cleanly when Docker is unavailable and run in CI. The user should start Docker before the DB/worker tasks if they want them verified locally.
- No Railway CLI and no credentials here. The Railway deploy step is prepared (Dockerfile, `railway.json`, docs) but executed by the user.
- Latest versions checked on npm: hono 4.13.22, @hono/node-server 2.1.11, mongodb 7.9.1, vitest 7.0.181, @testcontainers/mongodb 12.2.2, typescript 7.0.2, tailwindcss/@tailwindcss/cli 4.3.5, zod (check at install).

## Workflow rules (from global CLAUDE.md)

- One commit per task below. Sequence per task: edit → run review before commit → fix → commit → `/compact`.
- Save this plan as `docs/plans/01-m0-foundation.md` in the first commit (first plan in the repo, so prefix `01`).
- No `grep`-first code discovery needed: the repo is empty.

## Target layout (subset of PLAN.md section 4 needed for M0)

```
src/
  config/env.ts                 zod-validated environment
  database/client.ts            MongoClient factory, connect/close
  database/indexes.ts           idempotent ensureIndexes for all PLAN.md collections
  database/collections.ts       typed collection accessors + document types (skeletons)
  domain/                       shared types (Company, Job, ... minimal stubs for indexes)
  scheduling/agenda.ts          Agenda factory, job registry, heartbeat job
  web/app.ts                    createApp(deps) -> Hono
  web/auth.ts                   login/logout, session cookie, requireAuth middleware
  web/routes/{static,ssr,fragments}.tsx
  web/components/, web/layouts/Layout.tsx
  web/static/app.css            Tailwind source
  entrypoints/web.ts | worker.ts | build-static.ts
public/                         vendored htmx.min.js (copied from npm package at build)
tests/unit | integration | fixtures | e2e
Dockerfile, compose.yaml, railway.json, .env.example, .github/workflows/ci.yml
```

## Tasks (each is one commit)

### T1. Project scaffold
- `npm init`, `package.json` with scripts: `dev:web`, `dev:worker`, `build` (tsc + tailwind + build-static + copy htmx), `start:web`, `start:worker`, `typecheck`, `lint`, `test`, `test:integration`.
- Deps: hono, @hono/node-server, mongodb, agenda, @agendajs/mongo-backend, zod, htmx.org. Dev: typescript, tsx, vitest, @testcontainers/mongodb, tailwindcss, @tailwindcss/cli, eslint + typescript-eslint, @types/node.
- `tsconfig.json`: strict, `jsx: react-jsx`, `jsxImportSource: hono/jsx`, NodeNext modules, `outDir: dist`.
- `.gitignore`, `.env.example` (keys from PLAN.md section 12 + `AUTH_PASSWORD`, `PORT`), `README.md` with run commands.
- Copy this plan to `docs/plans/01-m0-foundation.md`.
- Verify: `npm run typecheck` passes on an empty `src/`.

### T2. Config module
- `src/config/env.ts`: `loadEnv(process.env)` → typed config via zod (`MONGODB_URI`, `MONGODB_DATABASE`, `APP_BASE_URL`, `SESSION_SECRET` min length, `AUTH_PASSWORD`, `PORT` default 3000, `HOST` default `0.0.0.0`, `LLM_*` optional for now).
- Unit tests: missing/invalid values fail with readable errors; defaults applied.

### T3. Database layer
- `src/database/client.ts`: `createMongoClient(config)` returning `{ client, db }`, `ping()`.
- `src/database/indexes.ts`: `ensureIndexes(db)` creating the collections and indexes from PLAN.md section 9: `companies` (unique `slug`), `jobs` (unique `{source, externalId}`, `{companyId}`, `{status, lastSeenAt}`), `searchProfiles`, `candidateProfiles` (`{version}`), `evaluations` (`{jobId, profileVersion, promptVersion}`), `resumeDrafts`, `applications` (unique `{jobId, candidateId}`), `syncRuns` (`{source, startedAt}`), `workerStatus`. Idempotent: `createIndex` with stable names, safe to re-run.
- `compose.yaml` with a MongoDB 8 service and a volume.
- Integration test (Testcontainers): `ensureIndexes` twice is a no-op; unique indexes reject duplicates. Guard: skip suite if Docker is unreachable.

### T4. Web app: layout, Tailwind, SSG + SSR routes
- `src/web/app.ts`: `createApp({ db?, config, now })` so SSG can build **without** a DB.
- `Layout.tsx` loading `/assets/app.css`, `/assets/htmx.min.js`, CSRF meta.
- SSG routes: `/` (dashboard shell with `hx-get="/fragments/dashboard" hx-trigger="load"`), `/about`. SSR routes with `disableSSG()`: `/jobs`, `/jobs/:id`, `/companies`, `/applications`, `/profile`, `/settings` as placeholder pages; `/fragments/dashboard` returning worker heartbeat + DB status fragment; `/health` returning JSON `{ db, workerHeartbeatAgeSeconds }`.
- HTMX requests detected via `HX-Request` header; fragments get `Cache-Control: no-store`.
- `src/entrypoints/build-static.ts`: `toSSG` into `dist/static`, plus Tailwind CLI step and htmx copy in `build`.
- Tests: `app.request()` for each route; SSG test asserts no DB dependency is touched (pass `db: undefined`, a throwing proxy) and generated files contain no values from a fake candidate profile / secrets.

### T5. Authentication and request protection
- `src/web/auth.ts`: `GET/POST /login` (password compared with `timingSafeEqual` to `AUTH_PASSWORD`), `POST /logout`, signed session cookie via `hono/cookie` (`HttpOnly`, `Secure` outside dev, `SameSite=Lax`), `hono/csrf` on mutations, `requireAuth` applied to `/`, `/fragments/*`, SSR routes and `/health`? (health stays public but reveals nothing sensitive; decide: public, minimal).
- Static assets served through explicit `/assets/*` mapping only, so static middleware cannot shadow authenticated routes.
- Tests: unauthenticated → 302 to `/login` for pages, 401 for fragments/HTMX; wrong password rejected; valid login sets cookie and grants access; CSRF rejects cross-origin POST.

### T6. Worker with Agenda and heartbeat
- `src/scheduling/agenda.ts`: `createAgenda(db)` with `MongoBackend({ mongo: db })`, job registry pattern (`defineJobs(agenda, deps)`), `heartbeat` job every 30s upserting `workerStatus` `{ _id: 'worker', lastHeartbeatAt, hostname, pid }`.
- `src/entrypoints/worker.ts`: connect, ensureIndexes, start Agenda, graceful `SIGTERM`/`SIGINT` → `agenda.stop()` then close client.
- Dashboard fragment and `/health` read `workerStatus` and report heartbeat age.
- Tests: unit test for heartbeat handler with an in-memory fake collection; integration test (Testcontainers) that the job runs once and writes the document.

### T7. Entry point `web.ts` and production static serving
- `src/entrypoints/web.ts`: load config, connect Mongo, `ensureIndexes`, `serve({ hostname: config.host, port: config.port })`, graceful shutdown.
- Serve `dist/static` via `serveStatic` from `@hono/node-server` under `/assets/*` and the SSG HTML files for `/` and `/about` explicitly (runtime renders the same TSX if the file is missing, so `dev` works without a build).
- Manual verify: start Mongo via compose, `npm run build && npm run start:web`, open `/login`, dashboard loads fragment.

### T8. Docker, Railway config, CI
- Multi-stage `Dockerfile` (`node:26-slim`): install, build, prune dev deps, `CMD` overridable per service. No Playwright yet (M3).
- `railway.json`: healthcheck path `/health`, restart policy; document `start:web` / `start:worker` start commands and required variables in `README.md`.
- `.github/workflows/ci.yml`: `npm ci`, typecheck, lint, unit + integration tests (runners have Docker), `docker build`.
- Verify: `docker build .` locally once Docker is up; otherwise CI proves it.

### T9. Hand-off for Railway deployment (user action)
- Checklist in `README.md`: create project, add MongoDB service or Atlas, set variables, two services from one repo with different start commands, confirm `/health` and heartbeat after redeploy.
- "Done when" for M0 per PLAN.md requires this step; I cannot execute it from this machine.

## Backlog (not in this session)

M1 job discovery (company registry, Greenhouse/Lever/Ashby adapters, normalization and dedup, sync scheduling and jobs UI), M2 matching, M3 resumes, M4 assisted applications, M5 controlled automation, exactly as PLAN.md section 15.

## Verification (end of M0)

1. `npm run typecheck && npm run lint && npm test` green locally (integration suites skipped if Docker is down, run in CI).
2. With Docker up: `docker compose up -d mongodb`, `npm run build`, `npm run start:web` and `npm run start:worker`; `curl localhost:3000/health` shows `db: ok` and a fresh heartbeat; browser login works and the dashboard fragment loads via HTMX.
3. `dist/static` contains `index.html`, `about.html`, `assets/app.css`, `assets/htmx.min.js` and no secrets or personal data.
4. CI workflow passes on push to `main`.
