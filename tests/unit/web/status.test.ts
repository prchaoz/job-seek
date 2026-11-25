import { describe, expect, it } from 'vitest';

import { getSystemStatus } from '../../../src/web/status.js';
import { FIXED_NOW, fakeStatusSource, heartbeatAt } from '../../fixtures/web.js';

describe('getSystemStatus', () => {
  it('reports a fresh heartbeat as healthy', async () => {
    const source = fakeStatusSource({ heartbeat: heartbeatAt(new Date(FIXED_NOW.getTime() - 20_000)) });
    const status = await getSystemStatus(source, FIXED_NOW);

    expect(status).toMatchObject({ db: 'ok', healthy: true, worker: { ageSeconds: 20, healthy: true } });
  });

  it('reports a stale heartbeat as unhealthy but keeps the service healthy', async () => {
    const source = fakeStatusSource({ heartbeat: heartbeatAt(new Date(FIXED_NOW.getTime() - 600_000)) });
    const status = await getSystemStatus(source, FIXED_NOW);

    expect(status.worker.lastHeartbeatAt).toBeInstanceOf(Date);
    expect(status.worker).toMatchObject({ ageSeconds: 600, healthy: false });
    expect(status.healthy).toBe(true);
  });

  it('reports a missing heartbeat', async () => {
    const status = await getSystemStatus(fakeStatusSource(), FIXED_NOW);
    expect(status.worker).toEqual({ lastHeartbeatAt: null, ageSeconds: null, healthy: false });
  });

  it('reports database failures without throwing', async () => {
    const status = await getSystemStatus(fakeStatusSource({ dbDown: true }), FIXED_NOW);
    expect(status).toMatchObject({ db: 'unavailable', healthy: false, worker: { healthy: false } });
  });
});
