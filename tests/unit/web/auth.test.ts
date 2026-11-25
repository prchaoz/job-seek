import { describe, expect, it } from 'vitest';

import { passwordMatches, safeNextPath, SESSION_COOKIE } from '../../../src/web/auth.js';
import { createApp } from '../../../src/web/app.js';
import { FIXED_NOW, fakeAuth, fakeDeps, loginCookie, TEST_PASSWORD } from '../../fixtures/web.js';

const form = (fields: Record<string, string>, headers: Record<string, string> = {}) => ({
  method: 'POST',
  // Browsers always send Origin on form posts; the csrf middleware relies on it.
  headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://localhost', ...headers },
  body: new URLSearchParams(fields),
});

describe('route protection', () => {
  const app = createApp({ mode: 'serve', deps: fakeDeps(), auth: fakeAuth() });

  it('redirects anonymous page requests to /login with a return path', async () => {
    const res = await app.request('/jobs?status=open');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login?next=%2Fjobs%3Fstatus%3Dopen');
  });

  it('answers anonymous htmx requests with 401 and HX-Redirect', async () => {
    const res = await app.request('/fragments/dashboard', { headers: { 'HX-Request': 'true' } });
    expect(res.status).toBe(401);
    expect(res.headers.get('hx-redirect')).toBe('/login');
  });

  it('keeps /health and /login public', async () => {
    expect((await app.request('/health')).status).toBe(200);
    const login = await app.request('/login');
    expect(login.status).toBe(200);
    expect(await login.text()).toContain('name="password"');
  });

  it('grants access after a successful login', async () => {
    const cookie = await loginCookie(app);
    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    const res = await app.request('/', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Dashboard');
  });

  it('rejects a tampered session cookie', async () => {
    const cookie = await loginCookie(app);
    const tampered = cookie.replace(/=(\d+)/, (_m, ts: string) => `=${Number(ts) + 1}`);
    const res = await app.request('/', { headers: { cookie: tampered } });
    expect(res.status).toBe(302);
  });

  it('rejects an expired session', async () => {
    const cookie = await loginCookie(app);
    const later = createApp({
      mode: 'serve',
      deps: fakeDeps(),
      auth: fakeAuth({ now: () => new Date(FIXED_NOW.getTime() + 8 * 24 * 3600 * 1000) }),
    });
    const res = await later.request('/', { headers: { cookie } });
    expect(res.status).toBe(302);
  });

  it('logs out by clearing the cookie', async () => {
    const cookie = await loginCookie(app);
    const res = await app.request('/logout', form({}, { cookie }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/login');
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });
});

describe('login form', () => {
  it('sets a hardened cookie and honours a safe next path', async () => {
    const app = createApp({ mode: 'serve', deps: fakeDeps(), auth: fakeAuth({ secureCookies: true }) });
    const res = await app.request('/login', form({ password: TEST_PASSWORD, next: '/companies' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/companies');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('ignores unsafe next paths', async () => {
    const app = createApp({ mode: 'serve', deps: fakeDeps(), auth: fakeAuth() });
    const res = await app.request('/login', form({ password: TEST_PASSWORD, next: 'https://evil.example' }));
    expect(res.headers.get('location')).toBe('/');
  });

  it('rejects a wrong password without setting a cookie', async () => {
    const app = createApp({ mode: 'serve', deps: fakeDeps(), auth: fakeAuth() });
    const res = await app.request('/login', form({ password: 'nope-nope-nope' }));
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await res.text()).toContain('Incorrect password');
  });

  it('throttles repeated failures per client', async () => {
    const app = createApp({ mode: 'serve', deps: fakeDeps(), auth: fakeAuth() });
    for (let i = 0; i < 5; i += 1) {
      expect((await app.request('/login', form({ password: 'wrong-password-x' }))).status).toBe(401);
    }
    const blocked = await app.request('/login', form({ password: TEST_PASSWORD }));
    expect(blocked.status).toBe(429);
    const other = await app.request('/login', form({ password: TEST_PASSWORD }, { 'x-forwarded-for': '10.0.0.9' }));
    expect(other.status).toBe(303);
  });

  it('rejects cross-origin and origin-less form posts', async () => {
    const app = createApp({ mode: 'serve', deps: fakeDeps(), auth: fakeAuth() });
    const crossOrigin = await app.request('/login', form({ password: TEST_PASSWORD }, { origin: 'https://evil.example' }));
    expect(crossOrigin.status).toBe(403);
    expect(crossOrigin.headers.get('set-cookie')).toBeNull();

    const noOrigin = await app.request('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: TEST_PASSWORD }),
    });
    expect(noOrigin.status).toBe(403);
  });
});

describe('helpers', () => {
  it('compares passwords of different lengths safely', () => {
    expect(passwordMatches('abc', 'abc')).toBe(true);
    expect(passwordMatches('abc', 'abcd')).toBe(false);
    expect(passwordMatches('', 'abc')).toBe(false);
  });

  it.each([
    [undefined, '/'],
    ['', '/'],
    ['/jobs', '/jobs'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    ['/a\\b', '/'],
  ])('safeNextPath(%j) -> %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
