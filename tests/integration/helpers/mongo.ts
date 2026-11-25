import { execSync } from 'node:child_process';

import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb';

import { connectDatabase, type DatabaseConnection } from '../../../src/database/client.js';

/** True when a container runtime is reachable; integration suites skip otherwise. */
export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

export type TestMongo = Readonly<{
  connection: DatabaseConnection;
  stop: () => Promise<void>;
}>;

export async function startTestMongo(database = `test_${Date.now()}`): Promise<TestMongo> {
  const container: StartedMongoDBContainer = await new MongoDBContainer('mongo:8').start();
  // Testcontainers starts a single-node replica set; connect directly to it.
  const uri = `${container.getConnectionString()}?directConnection=true`;
  const connection = await connectDatabase({ uri, database, appName: 'job-agent-test' });
  return {
    connection,
    stop: async () => {
      await connection.close();
      await container.stop();
    },
  };
}
