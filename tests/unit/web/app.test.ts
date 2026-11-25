import { describe, expect, it } from 'vitest';

import { createApp } from '../../../src/web/app.js';
import { FIXED_NOW, fakeDeps, fakeStatusSource, heartbeatAt } from '../../fixtures/web.js';

const app = createApp({ mode: 'serve', deps: fakeDeps(), isProduction: false });

describe('served pages', () => {
  it.each(['/', '/about', '/jobs', '/companies', '/applications', '/profile', '/settings'])(
    'renders %s as a full HTML page',
    async (path) => {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(body).toContain('/assets/app.css');
      expect(body).toContain('/assets/htmx.min.js');
    },
  );

  it('serves the dashboard shell that loads the status fragment via htmx', async () => {
    const body = await (await app.request('/')).text();
    expect(body).toContain('hx-get="/fragments/dashboard"');
    expect(body).toContain('hx-trigger="load');
  });

  it('returns 404 for unknown job ids and unknown paths', async () => {
    expect((await app.request('/jobs/abc')).status).toBe(404);
    expect((await app.request('/nope')).status).toBe(404);
  });
});

describe('fragments', () => {
  it('returns the status panel without caching', async () => {
    const res = await app.request('/fragments/dashboard', { headers: { 'HX-Request': 'true' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.text();
    expect(body).not.toContain('<html');
    expect(body).toContain('System status');
    expect(body).toContain('never reported');
  });
});

describe('/health', () => {
  it('returns ok with heartbeat age when everything works', async () => {
    const healthy = createApp({
      mode: 'serve',
      isProduction: false,
      deps: fakeDeps(fakeStatusSource({ heartbeat: heartbeatAt(new Date(FIXED_NOW.getTime() - 5_000)) })),
    });
    const res = await healthy.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      db: 'ok',
      workerHeartbeatAgeSeconds: 5,
      workerHealthy: true,
    });
  });

  it('returns 503 when the database is unreachable', async () => {
    const degraded = createApp({
      mode: 'serve',
      isProduction: false,
      deps: fakeDeps(fakeStatusSource({ dbDown: true })),
    });
    const res = await degraded.request('/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'degraded', db: 'unavailable' });
  });
});
