import { Hono } from 'hono';
import { disableSSG } from 'hono/ssg';

import { StatusPanel } from '../components/StatusPanel.js';
import { getSystemStatus } from '../status.js';
import type { AppEnv } from '../types.js';

/** htmx fragments: HTML partials, never cached, never statically generated. */
export const fragments = new Hono<AppEnv>();

fragments.use('*', disableSSG());
fragments.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('Vary', 'HX-Request');
});

fragments.get('/dashboard', async (c) => {
  const deps = c.get('deps');
  const now = deps.now();
  const status = await getSystemStatus(deps.status, now);
  return c.html(<StatusPanel status={status} now={now} />);
});
