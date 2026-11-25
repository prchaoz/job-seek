import type { WorkerStatusDocument } from '../../domain/documents.js';

export const HEARTBEAT_JOB = 'heartbeat';
export const HEARTBEAT_INTERVAL = '30 seconds';
export const WORKER_STATUS_ID = 'worker';

/** The subset of a MongoDB collection the heartbeat needs; easy to fake in tests. */
export type HeartbeatStore = {
  updateOne: (
    filter: { _id: string },
    update: { $set: Partial<WorkerStatusDocument>; $setOnInsert: Partial<WorkerStatusDocument> },
    options: { upsert: true },
  ) => Promise<unknown>;
};

export type HeartbeatDeps = Readonly<{
  store: HeartbeatStore;
  hostname: string;
  pid: number;
  startedAt: Date;
  now: () => Date;
}>;

/** Records that this worker process is alive. Read by the dashboard and /health. */
export function createHeartbeatHandler(deps: HeartbeatDeps): () => Promise<void> {
  return async () => {
    await deps.store.updateOne(
      { _id: WORKER_STATUS_ID },
      {
        $set: { lastHeartbeatAt: deps.now(), hostname: deps.hostname, pid: deps.pid },
        $setOnInsert: { startedAt: deps.startedAt },
      },
      { upsert: true },
    );
  };
}
