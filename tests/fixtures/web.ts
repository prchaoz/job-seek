import type { Hono } from 'hono';

import type { WorkerStatusDocument } from '../../src/domain/documents.js';
import type { AuthConfig } from '../../src/web/auth.js';
import type { StatusSource } from '../../src/web/status.js';
import type { AppEnv, WebDependencies } from '../../src/web/types.js';

export const FIXED_NOW = new Date('2026-11-25T10:00:00.000Z');

export function fakeStatusSource(
  overrides: Partial<{ heartbeat: WorkerStatusDocument | null; dbDown: boolean }> = {},
): StatusSource {
  return {
    ping: () => (overrides.dbDown ? Promise.reject(new Error('down')) : Promise.resolve()),
    findWorkerStatus: () => Promise.resolve(overrides.heartbeat ?? null),
  };
}

export function heartbeatAt(date: Date): WorkerStatusDocument {
  return { _id: 'worker', lastHeartbeatAt: date, hostname: 'test', pid: 1, startedAt: date };
}

export function fakeDeps(status: StatusSource = fakeStatusSource()): WebDependencies {
  return { status, now: () => FIXED_NOW };
}

export const TEST_PASSWORD = 'correct-horse-battery-staple';

export function fakeAuth(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    sessionSecret: 'test-session-secret-at-least-32-chars-long',
    password: TEST_PASSWORD,
    secureCookies: false,
    now: () => FIXED_NOW,
    ...overrides,
  };
}

/** Logs in against `app` and returns the Cookie header value for later requests. */
export async function loginCookie(app: Hono<AppEnv>): Promise<string> {
  const res = await app.request('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://localhost' },
    body: new URLSearchParams({ password: TEST_PASSWORD, next: '/' }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (res.status !== 303 || !setCookie) {
    throw new Error(`login failed: ${res.status} ${setCookie ?? ''}`);
  }
  return setCookie.split(';')[0] ?? '';
}
