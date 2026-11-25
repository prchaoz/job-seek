import type { ObjectId } from 'mongodb';

/**
 * Minimal document shapes needed by the foundation (M0). Later milestones
 * extend these types; indexes in src/database/indexes.ts reference the
 * fields declared here.
 */

export type CompanyDocument = {
  _id: ObjectId;
  /** Unique normalized identifier, e.g. "jetbrains". */
  slug: string;
  name: string;
  careersUrl?: string;
  atsType?: 'greenhouse' | 'lever' | 'ashby' | 'other';
  boardId?: string;
  countries: string[];
  priority: number;
  enabled: boolean;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type JobStatus = 'open' | 'closed';

export type JobDocument = {
  _id: ObjectId;
  source: string;
  externalId: string;
  companyId: ObjectId;
  title: string;
  url: string;
  status: JobStatus;
  contentHash: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  raw: unknown;
};

export type SearchProfileDocument = {
  _id: ObjectId;
  name: string;
  regions: string[];
  updatedAt: Date;
};

export type CandidateProfileDocument = {
  _id: ObjectId;
  version: number;
  createdAt: Date;
};

export type EvaluationDocument = {
  _id: ObjectId;
  jobId: ObjectId;
  profileVersion: number;
  promptVersion: string;
  createdAt: Date;
};

export type ResumeDraftDocument = {
  _id: ObjectId;
  jobId: ObjectId;
  version: number;
  createdAt: Date;
};

export type ApplicationDocument = {
  _id: ObjectId;
  jobId: ObjectId;
  candidateId: ObjectId;
  state: string;
  updatedAt: Date;
};

export type SyncRunDocument = {
  _id: ObjectId;
  source: string;
  startedAt: Date;
  finishedAt?: Date;
  status: 'running' | 'succeeded' | 'failed';
  error?: string;
};

export type WorkerStatusDocument = {
  _id: string;
  lastHeartbeatAt: Date;
  hostname: string;
  pid: number;
  startedAt: Date;
};
