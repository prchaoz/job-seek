import { toSSG, type FileSystemModule } from 'hono/ssg';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../src/web/app.js';

function memoryFs(): FileSystemModule & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    mkdir: () => Promise.resolve(),
    writeFile: (path, data) => {
      files.set(path, typeof data === 'string' ? data : new TextDecoder().decode(data));
      return Promise.resolve();
    },
  };
}

describe('static site generation', () => {
  it('generates only the public shell pages and never touches runtime dependencies', async () => {
    const app = createApp({ mode: 'ssg' });
    const fs = memoryFs();

    const result = await toSSG(app, fs, { dir: 'out' });

    expect(result.success).toBe(true);
    expect([...fs.files.keys()].sort()).toEqual(['out/about.html', 'out/index.html']);
  });

  it('does not expose secrets or personal data in generated files', async () => {
    process.env.SESSION_SECRET = 'super-secret-session-value-for-ssg-test';
    process.env.AUTH_PASSWORD = 'top-secret-password';
    process.env.MONGODB_URI = 'mongodb://user:pass@db.internal/jobagent';
    const app = createApp({ mode: 'ssg' });
    const fs = memoryFs();
    await toSSG(app, fs, { dir: 'out' });

    for (const [, content] of fs.files) {
      expect(content).not.toContain('super-secret');
      expect(content).not.toContain('top-secret');
      expect(content).not.toContain('mongodb://');
      expect(content).not.toMatch(/hx-get="\/fragments\/[^"]*"[^>]*>[^<]*(connected|alive)/);
    }
    expect(fs.files.get('out/index.html')).toContain('Loading status');
  });
});
