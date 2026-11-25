import { createHash, timingSafeEqual } from 'node:crypto';

import { Hono, type MiddlewareHandler } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { disableSSG } from 'hono/ssg';

import { LoginPage } from './components/LoginPage.js';
import { isHtmxRequest, type AppEnv } from './types.js';

export type AuthConfig = Readonly<{
  sessionSecret: string;
  password: string;
  /** Set the Secure flag; true in production (HTTPS). */
  secureCookies: boolean;
  now?: () => Date;
}>;

export const SESSION_COOKIE = 'job_agent_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_MS = 60_000;

export type Auth = Readonly<{
  /** `/login` and `/logout` handlers. Mount at the application root. */
  routes: Hono<AppEnv>;
  /** Redirects browsers to `/login`, answers htmx with 401 + HX-Redirect. */
  requireAuth: MiddlewareHandler<AppEnv>;
}>;

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** Constant-time comparison that does not leak the password length. */
export function passwordMatches(candidate: string, expected: string): boolean {
  return timingSafeEqual(sha256(candidate), sha256(expected));
}

/** Only same-site absolute paths are allowed as post-login destinations. */
export function safeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/';
  }
  return value;
}

type FailureWindow = { count: number; firstAt: number };

export function createAuth(config: AuthConfig): Auth {
  const now = config.now ?? (() => new Date());
  const failures = new Map<string, FailureWindow>();

  // Behind Railway's proxy every client has a distinct forwarded address. Without
  // a proxy all clients share one bucket, which for a single-user app is an
  // acceptable brute-force defence rather than a problem.
  const clientKey = (headers: Headers): string =>
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'local';

  const isThrottled = (key: string): boolean => {
    const entry = failures.get(key);
    if (!entry) return false;
    if (now().getTime() - entry.firstAt > LOGIN_FAILURE_WINDOW_MS) {
      failures.delete(key);
      return false;
    }
    return entry.count >= LOGIN_FAILURE_LIMIT;
  };

  const recordFailure = (key: string): void => {
    const current = now().getTime();
    const entry = failures.get(key);
    if (!entry || current - entry.firstAt > LOGIN_FAILURE_WINDOW_MS) {
      failures.set(key, { count: 1, firstAt: current });
    } else {
      entry.count += 1;
    }
  };

  const isAuthenticated = async (c: Parameters<MiddlewareHandler<AppEnv>>[0]): Promise<boolean> => {
    const value = await getSignedCookie(c, config.sessionSecret, SESSION_COOKIE);
    if (!value) return false;
    const issuedAt = Number.parseInt(value, 10);
    if (!Number.isFinite(issuedAt)) return false;
    const ageSeconds = (now().getTime() - issuedAt) / 1000;
    return ageSeconds >= 0 && ageSeconds <= SESSION_TTL_SECONDS;
  };

  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: config.secureCookies,
    maxAge: SESSION_TTL_SECONDS,
  };

  const routes = new Hono<AppEnv>();
  routes.use('/login', disableSSG());
  routes.use('/logout', disableSSG());

  routes.get('/login', async (c) => {
    if (await isAuthenticated(c)) {
      return c.redirect(safeNextPath(c.req.query('next')));
    }
    return c.render(<LoginPage next={safeNextPath(c.req.query('next'))} />, { title: 'Sign in' });
  });

  routes.post('/login', async (c) => {
    const body = await c.req.parseBody();
    const password = typeof body['password'] === 'string' ? body['password'] : '';
    const next = safeNextPath(typeof body['next'] === 'string' ? body['next'] : undefined);

    const key = clientKey(c.req.raw.headers);
    if (isThrottled(key)) {
      c.status(429);
      return c.render(<LoginPage next={next} error="Too many attempts. Try again in a minute." />, {
        title: 'Sign in',
      });
    }

    if (!passwordMatches(password, config.password)) {
      recordFailure(key);
      c.status(401);
      return c.render(<LoginPage next={next} error="Incorrect password." />, { title: 'Sign in' });
    }

    failures.delete(key);
    await setSignedCookie(c, SESSION_COOKIE, String(now().getTime()), config.sessionSecret, cookieOptions);
    return c.redirect(next, 303);
  });

  routes.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.redirect('/login', 303);
  });

  const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (await isAuthenticated(c)) {
      await next();
      return;
    }
    if (isHtmxRequest(c.req.raw.headers)) {
      c.header('HX-Redirect', '/login');
      return c.text('Unauthorized', 401);
    }
    const target = new URL(c.req.url);
    const nextPath = `${target.pathname}${target.search}`;
    return c.redirect(`/login?next=${encodeURIComponent(nextPath)}`, 302);
  };

  return { routes, requireAuth };
}
