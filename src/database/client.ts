import { MongoClient, type Db } from 'mongodb';

export type DatabaseConnection = Readonly<{
  client: MongoClient;
  db: Db;
  /** Round-trips to the server; throws when it is unreachable. */
  ping: () => Promise<void>;
  close: () => Promise<void>;
}>;

export type DatabaseOptions = Readonly<{
  uri: string;
  database: string;
  appName?: string;
}>;

export async function connectDatabase(options: DatabaseOptions): Promise<DatabaseConnection> {
  const client = new MongoClient(options.uri, {
    appName: options.appName ?? 'job-agent',
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();
  const db = client.db(options.database);
  return {
    client,
    db,
    ping: async () => {
      await db.command({ ping: 1 });
    },
    close: () => client.close(),
  };
}
