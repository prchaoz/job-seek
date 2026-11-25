import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from '../../src/config/env.js';

const validEnv = {
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 's'.repeat(32),
  AUTH_PASSWORD: 'correct-horse-battery',
};

describe('loadConfig', () => {
  it('applies defaults for optional values', () => {
    const config = loadConfig(validEnv);

    expect(config.nodeEnv).toBe('development');
    expect(config.isProduction).toBe(false);
    expect(config.mongodb).toEqual({ uri: 'mongodb://localhost:27017', database: 'jobagent' });
    expect(config.web).toEqual({ host: '0.0.0.0', port: 3000, baseUrl: 'http://localhost:3000' });
    expect(config.llm).toEqual({});
  });

  it('coerces PORT and reads optional LLM settings', () => {
    const config = loadConfig({
      ...validEnv,
      NODE_ENV: 'production',
      PORT: '8080',
      LLM_API_KEY: 'key',
      LLM_MODEL: 'claude-fable-5-1',
    });

    expect(config.isProduction).toBe(true);
    expect(config.web.port).toBe(8080);
    expect(config.llm).toEqual({ apiKey: 'key', model: 'claude-fable-5-1' });
  });

  it('treats blank values as missing', () => {
    expect(() => loadConfig({ ...validEnv, SESSION_SECRET: '   ' })).toThrow(ConfigError);
    expect(loadConfig({ ...validEnv, LLM_API_KEY: '' }).llm.apiKey).toBeUndefined();
  });

  it('reports every missing or invalid variable with a readable message', () => {
    let error: unknown;
    try {
      loadConfig({ MONGODB_URI: 'postgres://nope', PORT: '70000', AUTH_PASSWORD: 'short' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ConfigError);
    const issues = (error as ConfigError).issues;
    expect(issues).toEqual(
      expect.arrayContaining([
        'MONGODB_URI: MONGODB_URI must start with mongodb:// or mongodb+srv://',
        'SESSION_SECRET is required',
        'AUTH_PASSWORD: AUTH_PASSWORD must be at least 12 characters',
      ]),
    );
    expect(issues.some((issue) => issue.startsWith('PORT:'))).toBe(true);
    expect((error as Error).message).toContain('Invalid configuration');
  });
});
