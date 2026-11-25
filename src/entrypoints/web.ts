import { serve } from '@hono/node-server';

import { loadConfig } from '../config/env.js';
import { connectDatabase } from '../database/client.js';
import { ensureIndexes } from '../database/indexes.js';
import { createApp } from '../web/app.js';
import { createWebDependencies } from '../web/dependencies.js';

const config = loadConfig();
const connection = await connectDatabase({ ...config.mongodb, appName: 'job-agent-web' });
await ensureIndexes(connection.db);

const app = createApp({
  mode: 'serve',
  deps: createWebDependencies(connection.db),
  auth: {
    sessionSecret: config.auth.sessionSecret,
    password: config.auth.password,
    secureCookies: config.isProduction,
  },
  staticDir: process.env['STATIC_DIR'] ?? 'dist/static',
});

const server = serve({ fetch: app.fetch, hostname: config.web.host, port: config.web.port }, (info) => {
  console.log(`[web] listening on http://${info.address}:${info.port}`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[web] ${signal} received, closing…`);
  const forceExit = setTimeout(() => {
    console.error('[web] shutdown timed out, exiting');
    process.exit(1);
  }, 15_000);
  server.close((error) => {
    void connection.close().finally(() => {
      clearTimeout(forceExit);
      process.exit(error ? 1 : 0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
