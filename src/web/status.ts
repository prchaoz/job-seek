import type { Db } from 'mongodb';

import { getCollections } from '../database/collections.js';
import type { WorkerStatusDocument } from '../domain/documents.js';

/** Heartbeats are written every 30s; anything older than this is unhealthy. */
export const WORKER_HEARTBEAT_STALE_SECONDS = 90;

export type StatusSource = Readonly<{
  ping: () => Promise<void>;
  findWorkerStatus: () => Promise<WorkerStatusDocument | null>;
}>;

export type SystemStatus = Readonly<{
  db: 'ok' | 'unavailable';
  worker: Readonly<{
    lastHeartbeatAt: Date | null;
    ageSeconds: number | null;
    healthy: boolean;
  }>;
  healthy: boolean;
}>;

export function createStatusSource(db: Db): StatusSource {
  const { workerStatus } = getCollections(db);
  return {
    ping: async () => {
      await db.command({ ping: 1 });
    },
    findWorkerStatus: () => workerStatus.findOne({ _id: 'worker' }),
  };
}

export async function getSystemStatus(source: StatusSource, now: Date): Promise<SystemStatus> {
  let dbStatus: SystemStatus['db'] = 'ok';
  let heartbeat: WorkerStatusDocument | null = null;
  try {
    await source.ping();
    heartbeat = await source.findWorkerStatus();
  } catch {
    dbStatus = 'unavailable';
  }

  const lastHeartbeatAt = heartbeat?.lastHeartbeatAt ?? null;
  const ageSeconds =
    lastHeartbeatAt === null ? null : Math.max(0, Math.round((now.getTime() - lastHeartbeatAt.getTime()) / 1000));
  const workerHealthy = ageSeconds !== null && ageSeconds <= WORKER_HEARTBEAT_STALE_SECONDS;

  return {
    db: dbStatus,
    worker: { lastHeartbeatAt, ageSeconds, healthy: workerHealthy },
    healthy: dbStatus === 'ok',
  };
}
