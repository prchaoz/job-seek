import { Hono } from 'hono';
import { disableSSG } from 'hono/ssg';

import { getSystemStatus } from '../status.js';
import type { AppEnv } from '../types.js';

/** Liveness/readiness endpoint for Railway health checks. Public, minimal. */
export const health = new Hono<AppEnv>();

health.use('*', disableSSG());

health.get('/', async (c) => {
  const deps = c.get('deps');
  const status = await getSystemStatus(deps.status, deps.now());
  c.header('Cache-Control', 'no-store');
  return c.json(
    {
      status: status.healthy ? 'ok' : 'degraded',
      db: status.db,
      workerHeartbeatAgeSeconds: status.worker.ageSeconds,
      workerHealthy: status.worker.healthy,
    },
    status.healthy ? 200 : 503,
  );
});
