import { hostname } from 'node:os';

import { MongoBackend } from '@agendajs/mongo-backend';
import { Agenda } from 'agenda';
import type { Db } from 'mongodb';

import { getCollections } from '../database/collections.js';
import { createHeartbeatHandler, HEARTBEAT_INTERVAL, HEARTBEAT_JOB } from './jobs/heartbeat.js';

export const AGENDA_COLLECTION = 'agendaJobs';

export type WorkerOptions = Readonly<{
  /** Poll interval; shorter values make tests fast. */
  processEvery?: string | number;
  now?: () => Date;
}>;

/**
 * Creates an Agenda instance bound to the shared MongoDB connection. The
 * connection stays owned by the caller, so `agenda.stop()` never closes it.
 */
export function createAgenda(db: Db, options: WorkerOptions = {}): Agenda {
  return new Agenda({
    name: `job-agent-worker@${hostname()}#${process.pid}`,
    backend: new MongoBackend({ mongo: db, collection: AGENDA_COLLECTION }),
    processEvery: options.processEvery ?? '10 seconds',
    defaultLockLifetime: 5 * 60 * 1000,
  });
}

/** Registers every job processor. Add new durable tasks here. */
export function defineJobs(agenda: Agenda, db: Db, options: WorkerOptions = {}): void {
  const { workerStatus } = getCollections(db);
  const heartbeat = createHeartbeatHandler({
    store: workerStatus,
    hostname: hostname(),
    pid: process.pid,
    startedAt: new Date(),
    now: options.now ?? (() => new Date()),
  });

  agenda.define(HEARTBEAT_JOB, async () => heartbeat(), { concurrency: 1, lockLifetime: 60_000 });
}

/** Ensures recurring schedules exist. Idempotent: Agenda upserts by job name. */
export async function scheduleRecurringJobs(agenda: Agenda): Promise<void> {
  await agenda.every(HEARTBEAT_INTERVAL, HEARTBEAT_JOB);
}

export type RunningWorker = Readonly<{
  agenda: Agenda;
  /** Waits for in-flight jobs, then stops polling. Leaves the DB connection open. */
  stop: () => Promise<void>;
}>;

export async function startWorker(db: Db, options: WorkerOptions = {}): Promise<RunningWorker> {
  const agenda = createAgenda(db, options);
  agenda.on('error', (error) => console.error('[agenda] error', error));
  agenda.on('fail', (error, job) => console.error(`[agenda] job ${job.attrs.name} failed`, error));

  defineJobs(agenda, db, options);
  await agenda.ready;
  await agenda.start();
  try {
    await scheduleRecurringJobs(agenda);
  } catch (error) {
    // Never leave a polling loop behind without a stop handle.
    await agenda.stop(false);
    throw error;
  }

  return {
    agenda,
    stop: async () => {
      await agenda.drain({ closeConnection: false });
    },
  };
}
