import type { Collection, Db } from 'mongodb';

import type {
  ApplicationDocument,
  CandidateProfileDocument,
  CompanyDocument,
  EvaluationDocument,
  JobDocument,
  ResumeDraftDocument,
  SearchProfileDocument,
  SyncRunDocument,
  WorkerStatusDocument,
} from '../domain/documents.js';

export const collectionNames = {
  companies: 'companies',
  jobs: 'jobs',
  searchProfiles: 'searchProfiles',
  candidateProfiles: 'candidateProfiles',
  evaluations: 'evaluations',
  resumeDrafts: 'resumeDrafts',
  applications: 'applications',
  syncRuns: 'syncRuns',
  workerStatus: 'workerStatus',
} as const;

export type Collections = Readonly<{
  companies: Collection<CompanyDocument>;
  jobs: Collection<JobDocument>;
  searchProfiles: Collection<SearchProfileDocument>;
  candidateProfiles: Collection<CandidateProfileDocument>;
  evaluations: Collection<EvaluationDocument>;
  resumeDrafts: Collection<ResumeDraftDocument>;
  applications: Collection<ApplicationDocument>;
  syncRuns: Collection<SyncRunDocument>;
  workerStatus: Collection<WorkerStatusDocument>;
}>;

export function getCollections(db: Db): Collections {
  return {
    companies: db.collection<CompanyDocument>(collectionNames.companies),
    jobs: db.collection<JobDocument>(collectionNames.jobs),
    searchProfiles: db.collection<SearchProfileDocument>(collectionNames.searchProfiles),
    candidateProfiles: db.collection<CandidateProfileDocument>(collectionNames.candidateProfiles),
    evaluations: db.collection<EvaluationDocument>(collectionNames.evaluations),
    resumeDrafts: db.collection<ResumeDraftDocument>(collectionNames.resumeDrafts),
    applications: db.collection<ApplicationDocument>(collectionNames.applications),
    syncRuns: db.collection<SyncRunDocument>(collectionNames.syncRuns),
    workerStatus: db.collection<WorkerStatusDocument>(collectionNames.workerStatus),
  };
}
