# Job Agent

Personal job-search agent. See [PLAN.md](PLAN.md) for the full design and
[docs/plans](docs/plans) for the chronological implementation plans.

## Requirements

- Node.js 26+
- npm (the project deviates from PLAN.md and uses npm instead of pnpm)
- Docker, for local MongoDB and integration tests. Any runtime that provides the
  `docker` CLI works (Docker Desktop, Colima, Rancher Desktop); the tests derive
  `DOCKER_HOST` from the active Docker context.

## Commands

```sh
cp .env.example .env            # fill in SESSION_SECRET and AUTH_PASSWORD
docker compose up -d mongodb    # local MongoDB (or: docker run -d -p 27017:27017 mongo:8)
npm install
npm run dev:web                 # web service with reload
npm run dev:worker              # background worker with reload
npm run typecheck && npm run lint && npm test
npm run build                   # compiled TS, Tailwind CSS, htmx, static pages -> dist/
npm run start:web / npm run start:worker
```

Integration tests use Testcontainers and are skipped when Docker is not reachable.

## Services

| Service  | Command                           | Notes                                         |
|----------|-----------------------------------|-----------------------------------------------|
| `web`    | `node dist/entrypoints/web.js`    | Binds `HOST:PORT`, health check on `/health`  |
| `worker` | `node dist/entrypoints/worker.js` | Agenda jobs; writes a heartbeat every 30s     |

Both services share one Docker image built from the `Dockerfile`. The image runs
node directly as PID 1 so `SIGTERM` reaches the processes and they shut down cleanly.

### Environment variables

| Variable           | Required | Description                                              |
|--------------------|----------|----------------------------------------------------------|
| `MONGODB_URI`      | yes      | `mongodb://` or `mongodb+srv://` connection string       |
| `MONGODB_DATABASE` | no       | Database name, default `jobagent`                        |
| `SESSION_SECRET`   | yes      | At least 32 random characters; signs the session cookie  |
| `AUTH_PASSWORD`    | yes      | At least 12 characters; the single dashboard password    |
| `APP_BASE_URL`     | no       | Public URL of the web service                            |
| `HOST` / `PORT`    | no       | Defaults `0.0.0.0` / `3000`; Railway injects `PORT`      |
| `NODE_ENV`         | no       | `production` enables the `Secure` cookie flag            |
| `LLM_API_KEY`, `LLM_MODEL` | no | Used from milestone M2 onwards                      |

## Deploying to Railway

Deployment is manual and needs a Railway account; nothing in CI deploys.

1. Create a Railway project and connect it to this GitHub repository.
2. Add a **MongoDB** database service (or use MongoDB Atlas and skip this step).
3. Create the **web** service from the repository. `railway.json` already sets the
   Dockerfile builder, the start command and the `/health` health check.
   Add variables: `MONGODB_URI` (reference the database service's connection
   string, or your Atlas URI), `SESSION_SECRET`, `AUTH_PASSWORD`,
   `NODE_ENV=production`, `APP_BASE_URL=https://<your-domain>`.
   Generate a public domain for this service.
4. Create the **worker** service from the same repository with the same variables.
   Override its start command with `node dist/entrypoints/worker.js` and remove the
   health check (the worker exposes no HTTP port).
5. Deploy both. Open `https://<your-domain>/health`: it must return `"db":"ok"` and
   within a minute `"workerHealthy":true`.
6. Sign in at `/login` with `AUTH_PASSWORD`; the dashboard shows database and worker status.
7. Redeploy once and confirm both services come back and the heartbeat resumes.
   M0 is complete when that holds.

Backups: enable the Railway database volume backups (or Atlas backups) before
real application history accumulates.

## Continuous integration

`.github/workflows/ci.yml` runs typecheck, lint, build, unit and integration tests
(Testcontainers on the runner's Docker), then builds the Docker image and checks
the compiled artifacts inside it.
