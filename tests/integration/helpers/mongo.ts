import { execSync } from 'node:child_process';

import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb';

import { connectDatabase, type DatabaseConnection } from '../../../src/database/client.js';

/**
 * True when a container runtime is reachable; integration suites skip otherwise.
 * Testcontainers ignores the Docker CLI context (Colima, Rancher Desktop, ...),
 * so the active context's endpoint is exported as DOCKER_HOST when unset.
 */
export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 10_000 });
    if (!process.env.DOCKER_HOST) {
      const host = execSync("docker context inspect --format '{{.Endpoints.docker.Host}}'", {
        encoding: 'utf8',
        timeout: 10_000,
      }).trim();
      if (host) {
        process.env.DOCKER_HOST = host;
        // Ryuk mounts the daemon socket from inside the VM, not the host-side path.
        process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE ??= '/var/run/docker.sock';
      }
    }
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
