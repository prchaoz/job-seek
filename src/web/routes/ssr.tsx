import { Hono } from 'hono';
import { disableSSG } from 'hono/ssg';

import { Placeholder } from '../components/Placeholder.js';
import type { AppEnv } from '../types.js';

/** Server-rendered pages. Excluded from static generation. */
export const ssrPages = new Hono<AppEnv>();

const placeholders = [
  { path: '/jobs', title: 'Jobs', milestone: 'M1 — Job discovery' },
  { path: '/companies', title: 'Companies', milestone: 'M1 — Job discovery' },
  { path: '/applications', title: 'Applications', milestone: 'M4 — Assisted applications' },
  { path: '/profile', title: 'Profile', milestone: 'M2 — Intelligent matching' },
  { path: '/settings', title: 'Settings', milestone: 'M1 — Job discovery' },
] as const;

for (const page of placeholders) {
  ssrPages.get(page.path, disableSSG(), (c) =>
    c.render(<Placeholder title={page.title} milestone={page.milestone} />, {
      title: page.title,
      currentPath: page.path,
    }),
  );
}

ssrPages.get('/jobs/:id', disableSSG(), (c) => {
  c.status(404);
  return c.render(<Placeholder title={`Job ${c.req.param('id')}`} milestone="M1 — Job discovery" />, {
    title: 'Job',
    currentPath: '/jobs',
  });
});
