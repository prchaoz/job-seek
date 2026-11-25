import type { WorkerStatusDocument } from '../../src/domain/documents.js';
import type { StatusSource } from '../../src/web/status.js';
import type { WebDependencies } from '../../src/web/types.js';

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
