import fs from 'node:fs/promises';

import { toSSG } from 'hono/ssg';

import { createApp } from '../web/app.js';

const outDir = process.argv[2] ?? 'dist/static';

const app = createApp({ mode: 'ssg' });
const result = await toSSG(app, fs, { dir: outDir });

if (!result.success) {
  console.error('Static generation failed:', result.error);
  process.exit(1);
}

for (const file of result.files) {
  console.log(`generated ${file}`);
}
