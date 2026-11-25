import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';

import { createAuth } from './auth.js';
import { layoutRenderer } from './layouts/Layout.js';

import { fragments } from './routes/fragments.js';
import { health } from './routes/health.js';
import { staticPages } from './routes/pages.js';
import { ssrPages } from './routes/ssr.js';
import type { AppEnv, AppOptions } from './types.js';

/**
 * Builds the Hono application.
 *
 * - `ssg` mode mounts only the build-time pages and has no database access,
 *   so static generation can run without secrets or a running MongoDB.
 * - `serve` mode mounts everything, injects runtime dependencies and
 *   protects every route except `/health`, `/login` and `/assets/*`.
 *
 * Static files are mounted on explicit paths only, so the static middleware
 * can never shadow an authenticated or dynamic route.
 */
export function createApp(options: AppOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', secureHeaders());
  app.use('*', layoutRenderer);

  if (options.mode === 'ssg') {
    app.route('/', staticPages);
    return app;
  }

  app.use('*', async (c, next) => {
    c.set('deps', options.deps);
    await next();
  });

  // Rejects cross-origin form posts (Origin / Sec-Fetch-Site checks).
  app.use('*', csrf());

  const auth = createAuth(options.auth);

  // Public routes are mounted before requireAuth so they never hit it.
  app.route('/health', health);
  app.route('/', auth.routes);
  if (options.staticDir) {
    app.use('/assets/*', serveStatic({ root: options.staticDir }));
  }
  // Unknown assets are a plain 404, never a login redirect.
  app.all('/assets/*', (c) => c.text('Not found', 404));

  app.use('*', auth.requireAuth);
  if (options.staticDir) {
    // Pre-rendered shell pages; fall through to the TSX routes when absent.
    app.get('/', serveStatic({ root: options.staticDir, path: 'index.html' }));
    app.get('/about', serveStatic({ root: options.staticDir, path: 'about.html' }));
  }
  app.route('/fragments', fragments);
  app.route('/', ssrPages);
  app.route('/', staticPages);

  app.notFound((c) => c.text('Not found', 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }
    console.error(error);
    return c.text('Internal server error', 500);
  });

  return app;
}
