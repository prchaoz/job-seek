import type { Db, IndexDescription } from 'mongodb';

import { collectionNames } from './collections.js';

/**
 * Index definitions per collection. Every index has a stable explicit name so
 * that re-running ensureIndexes is a no-op and changed definitions surface as
 * a clear conflict instead of silently creating duplicates.
 */
export const indexDefinitions: Readonly<Record<string, readonly IndexDescription[]>> = {
  [collectionNames.companies]: [{ key: { slug: 1 }, name: 'uniq_slug', unique: true }],
  [collectionNames.jobs]: [
    { key: { source: 1, externalId: 1 }, name: 'uniq_source_externalId', unique: true },
    { key: { companyId: 1 }, name: 'companyId' },
    { key: { status: 1, lastSeenAt: -1 }, name: 'status_lastSeenAt' },
  ],
  [collectionNames.searchProfiles]: [{ key: { name: 1 }, name: 'uniq_name', unique: true }],
  [collectionNames.candidateProfiles]: [{ key: { version: -1 }, name: 'uniq_version', unique: true }],
  [collectionNames.evaluations]: [
    {
      key: { jobId: 1, profileVersion: 1, promptVersion: 1 },
      name: 'uniq_job_profile_prompt',
      unique: true,
    },
  ],
  [collectionNames.resumeDrafts]: [{ key: { jobId: 1, version: -1 }, name: 'jobId_version' }],
  [collectionNames.applications]: [
    { key: { jobId: 1, candidateId: 1 }, name: 'uniq_job_candidate', unique: true },
    { key: { state: 1, updatedAt: -1 }, name: 'state_updatedAt' },
  ],
  [collectionNames.syncRuns]: [{ key: { source: 1, startedAt: -1 }, name: 'source_startedAt' }],
  [collectionNames.workerStatus]: [],
};

/**
 * Creates all collections and indexes. Safe to run on every startup.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const [name, indexes] of Object.entries(indexDefinitions)) {
    if (!existing.has(name)) {
      await db.createCollection(name);
    }
    if (indexes.length > 0) {
      await db.collection(name).createIndexes([...indexes]);
    }
  }
}
