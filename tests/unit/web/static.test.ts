import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/web/app.js';
import type { AppEnv } from '../../../src/web/types.js';
import type { Hono } from 'hono';
import { fakeAuth, fakeDeps, loginCookie } from '../../fixtures/web.js';

describe('static files', () => {
  let app: Hono<AppEnv>;
  let cookie: string;

  beforeAll(async () => {
    // serveStatic resolves root relative to the working directory.
    const dir = await mkdtemp(join(tmpdir(), 'job-agent-static-'));
    await mkdir(join(dir, 'assets'), { recursive: true });
    await writeFile(join(dir, 'assets', 'app.css'), 'body{color:red}');
    await writeFile(join(dir, 'index.html'), '<!DOCTYPE html><html><body>prebuilt shell</body></html>');
    app = createApp({ mode: 'serve', deps: fakeDeps(), auth: fakeAuth(), staticDir: relative(process.cwd(), dir) });
    cookie = await loginCookie(app);
  });

  afterAll(() => undefined);

  it('serves assets publicly', async () => {
    const res = await app.request('/assets/app.css');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/css');
    expect(await res.text()).toBe('body{color:red}');
  });

  it('returns 404 for missing assets instead of falling into page routes', async () => {
    expect((await app.request('/assets/missing.js')).status).toBe(404);
  });

  it('does not serve files outside the assets prefix without authentication', async () => {
    const res = await app.request('/index.html');
    expect(res.status).toBe(302);
  });

  it('serves the pre-rendered shell to authenticated users', async () => {
    const res = await app.request('/', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('prebuilt shell');
  });

  it('keeps the shell behind authentication', async () => {
    expect((await app.request('/')).status).toBe(302);
  });

  it('falls back to runtime rendering when a pre-rendered page is missing', async () => {
    const res = await app.request('/about', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<h1 class="mb-2 text-2xl font-semibold">About</h1>');
  });
});
