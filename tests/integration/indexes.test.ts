import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { collectionNames, getCollections } from '../../src/database/collections.js';
import { ensureIndexes, indexDefinitions } from '../../src/database/indexes.js';
import { isDockerAvailable, startTestMongo, type TestMongo } from './helpers/mongo.js';

describe.skipIf(!isDockerAvailable())('ensureIndexes', () => {
  let mongo: TestMongo;

  beforeAll(async () => {
    mongo = await startTestMongo();
  });

  afterAll(async () => {
    await mongo?.stop();
  });

  it('creates every collection and index, and is idempotent', async () => {
    const { db } = mongo.connection;
    await ensureIndexes(db);
    await ensureIndexes(db);

    const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    expect(collections.sort()).toEqual(Object.values(collectionNames).sort());

    for (const [name, definitions] of Object.entries(indexDefinitions)) {
      const indexNames = (await db.collection(name).indexes()).map((index) => index.name).sort();
      const expected = ['_id_', ...definitions.map((d) => d.name as string)].sort();
      expect(indexNames, name).toEqual(expected);
    }
  });

  it('rejects duplicate jobs for the same source and external id', async () => {
    const { db } = mongo.connection;
    await ensureIndexes(db);
    const { jobs } = getCollections(db);
    const base = {
      companyId: new ObjectId(),
      title: 'Senior Engineer',
      url: 'https://example.com/jobs/1',
      status: 'open' as const,
      contentHash: 'abc',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      raw: {},
    };

    await jobs.insertOne({ _id: new ObjectId(), source: 'greenhouse', externalId: '1', ...base });
    await expect(
      jobs.insertOne({ _id: new ObjectId(), source: 'greenhouse', externalId: '1', ...base }),
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      jobs.insertOne({ _id: new ObjectId(), source: 'lever', externalId: '1', ...base }),
    ).resolves.toBeDefined();
  });
});
