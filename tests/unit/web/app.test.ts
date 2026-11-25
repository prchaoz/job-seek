import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/web/app.js';
import { FIXED_NOW, fakeAuth, fakeDeps, fakeStatusSource, heartbeatAt, loginCookie } from '../../fixtures/web.js';

const app = createApp({ mode: 'serve', deps: fakeDeps(), auth: fakeAuth() });
let cookie = '';

beforeAll(async () => {
  cookie = await loginCookie(app);
});

const get = (path: string, headers: Record<string, string> = {}) =>
  app.request(path, { headers: { cookie, ...headers } });

describe('served pages', () => {
  it.each(['/', '/about', '/jobs', '/companies', '/applications', '/profile', '/settings'])(
    'renders %s as a full HTML page',
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(body).toContain('/assets/app.css');
      expect(body).toContain('/assets/htmx.min.js');
    },
  );

  it('serves the dashboard shell that loads the status fragment via htmx', async () => {
    const body = await (await get('/')).text();
    expect(body).toContain('hx-get="/fragments/dashboard"');
    expect(body).toContain('hx-trigger="load');
  });

  it('returns 404 for unknown job ids and unknown paths', async () => {
    expect((await get('/jobs/abc')).status).toBe(404);
    expect((await get('/nope')).status).toBe(404);
  });
});

describe('fragments', () => {
  it('returns the status panel without caching', async () => {
    const res = await get('/fragments/dashboard', { 'HX-Request': 'true' });
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
      auth: fakeAuth(),
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
      auth: fakeAuth(),
      deps: fakeDeps(fakeStatusSource({ dbDown: true })),
    });
    const res = await degraded.request('/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'degraded', db: 'unavailable' });
  });
});
