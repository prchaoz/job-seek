import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getCollections } from '../../src/database/collections.js';
import { ensureIndexes } from '../../src/database/indexes.js';
import { AGENDA_COLLECTION, startWorker, type RunningWorker } from '../../src/scheduling/agenda.js';
import { HEARTBEAT_JOB } from '../../src/scheduling/jobs/heartbeat.js';
import { createStatusSource, getSystemStatus } from '../../src/web/status.js';
import { isDockerAvailable, startTestMongo, type TestMongo } from './helpers/mongo.js';

async function waitFor<T>(probe: () => Promise<T | null | undefined>, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe.skipIf(!isDockerAvailable())('worker', () => {
  let mongo: TestMongo;
  let worker: RunningWorker | undefined;

  beforeAll(async () => {
    mongo = await startTestMongo();
    await ensureIndexes(mongo.connection.db);
  });

  afterAll(async () => {
    await worker?.stop();
    await mongo?.stop();
  });

  it('writes a heartbeat that the web status reports as healthy', async () => {
    const { db } = mongo.connection;
    worker = await startWorker(db, { processEvery: 200 });

    const doc = await waitFor(() => getCollections(db).workerStatus.findOne({ _id: 'worker' }));
    expect(doc.pid).toBe(process.pid);
    expect(doc.lastHeartbeatAt).toBeInstanceOf(Date);

    const status = await getSystemStatus(createStatusSource(db), new Date());
    expect(status.worker.healthy).toBe(true);

    const scheduled = await db.collection(AGENDA_COLLECTION).find({ name: HEARTBEAT_JOB }).toArray();
    expect(scheduled).toHaveLength(1);
  });

  it('stops cleanly without closing the shared connection', async () => {
    await worker?.stop();
    worker = undefined;
    await expect(mongo.connection.ping()).resolves.toBeUndefined();
  });
});
