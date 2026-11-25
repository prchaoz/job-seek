# Job Agent

Personal job-search agent. See [PLAN.md](PLAN.md) for the full design and
[docs/plans](docs/plans) for the chronological implementation plans.

## Requirements

- Node.js 26+
- npm (the project deviates from PLAN.md and uses npm instead of pnpm)
- Docker, for local MongoDB and integration tests

## Commands

```sh
cp .env.example .env            # fill in SESSION_SECRET and AUTH_PASSWORD
docker compose up -d mongodb    # local MongoDB
npm install
npm run dev:web                 # web service with reload
npm run dev:worker              # background worker with reload
npm run typecheck && npm run lint && npm test
npm run build                   # compiled TS, Tailwind CSS, htmx, static pages -> dist/
npm run start:web / npm run start:worker
```

Integration tests use Testcontainers and are skipped when Docker is not reachable.
