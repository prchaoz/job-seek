import { loadConfig } from '../config/env.js';
import { connectDatabase } from '../database/client.js';
import { ensureIndexes } from '../database/indexes.js';
import { startWorker } from '../scheduling/agenda.js';

const config = loadConfig();
const connection = await connectDatabase({ ...config.mongodb, appName: 'job-agent-worker' });
await ensureIndexes(connection.db);

const worker = await startWorker(connection.db);
console.log(`[worker] started (pid ${process.pid})`);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${signal} received, draining jobs…`);
  const forceExit = setTimeout(() => {
    console.error('[worker] drain timed out, exiting');
    process.exit(1);
  }, 30_000);
  try {
    await worker.stop();
    await connection.close();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error('[worker] shutdown failed', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
