import { describe, expect, it, vi } from 'vitest';

import { createHeartbeatHandler, WORKER_STATUS_ID } from '../../src/scheduling/jobs/heartbeat.js';

describe('heartbeat job', () => {
  it('upserts the worker status document with the current time', async () => {
    const updateOne = vi.fn().mockResolvedValue({ acknowledged: true });
    const startedAt = new Date('2026-11-25T09:00:00Z');
    const now = new Date('2026-11-25T10:00:00Z');
    const run = createHeartbeatHandler({
      store: { updateOne },
      hostname: 'worker-1',
      pid: 42,
      startedAt,
      now: () => now,
    });

    await run();

    expect(updateOne).toHaveBeenCalledWith(
      { _id: WORKER_STATUS_ID },
      {
        $set: { lastHeartbeatAt: now, hostname: 'worker-1', pid: 42 },
        $setOnInsert: { startedAt },
      },
      { upsert: true },
    );
  });
});
