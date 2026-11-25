import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const source = require.resolve('htmx.org/dist/htmx.min.js');
const target = join('dist', 'static', 'assets', 'htmx.min.js');

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`copied ${source} -> ${target}`);
