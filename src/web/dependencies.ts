import type { Db } from 'mongodb';

import { createStatusSource } from './status.js';
import type { WebDependencies } from './types.js';

export function createWebDependencies(db: Db): WebDependencies {
  return {
    status: createStatusSource(db),
    now: () => new Date(),
  };
}
