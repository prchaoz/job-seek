import { Hono } from 'hono';

import type { AppEnv } from '../types.js';

/**
 * Pages that are generated at build time (SSG). They must not read the
 * database or any secret: the dashboard loads live data via htmx.
 */
export const staticPages = new Hono<AppEnv>();

staticPages.get('/', (c) =>
  c.render(
    <>
      <h1 class="mb-6 text-2xl font-semibold">Dashboard</h1>
      <section hx-get="/fragments/dashboard" hx-trigger="load, every 30s" hx-swap="innerHTML">
        <p class="text-slate-500">Loading status…</p>
      </section>
    </>,
    { currentPath: '/' },
  ),
);

staticPages.get('/about', (c) =>
  c.render(
    <>
      <h1 class="mb-2 text-2xl font-semibold">About</h1>
      <p class="text-slate-600">
        Job Agent discovers relevant vacancies, evaluates fit, prepares truthful tailored resumes and
        tracks applications. Single user, private deployment.
      </p>
    </>,
    { title: 'About', currentPath: '/about' },
  ),
);
