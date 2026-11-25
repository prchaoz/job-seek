import { z } from 'zod';

const nonEmpty = (name: string) => z.string().trim().min(1, `${name} is required`);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: nonEmpty('MONGODB_URI').refine(
    (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
    'MONGODB_URI must start with mongodb:// or mongodb+srv://',
  ),
  MONGODB_DATABASE: nonEmpty('MONGODB_DATABASE').default('jobagent'),
  HOST: nonEmpty('HOST').default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_BASE_URL: z.url({ error: 'APP_BASE_URL must be an absolute URL' }).default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  AUTH_PASSWORD: z.string().min(12, 'AUTH_PASSWORD must be at least 12 characters'),
  LLM_API_KEY: nonEmpty('LLM_API_KEY').optional(),
  LLM_MODEL: nonEmpty('LLM_MODEL').optional(),
});

export type AppConfig = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  mongodb: Readonly<{ uri: string; database: string }>;
  web: Readonly<{ host: string; port: number; baseUrl: string }>;
  auth: Readonly<{ sessionSecret: string; password: string }>;
  llm: Readonly<{ apiKey?: string; model?: string }>;
}>;

export class ConfigError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/**
 * Parses and validates process environment into a typed configuration.
 * Empty strings are treated as unset so that `.env` templates with blank
 * values behave the same as missing variables.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const key = issue.path.join('.') || '(root)';
      return issue.code === 'invalid_type' && issue.message.includes('undefined')
        ? `${key} is required`
        : `${key}: ${issue.message}`;
    });
    throw new ConfigError(issues);
  }

  const value = parsed.data;
  return {
    nodeEnv: value.NODE_ENV,
    isProduction: value.NODE_ENV === 'production',
    mongodb: { uri: value.MONGODB_URI, database: value.MONGODB_DATABASE },
    web: { host: value.HOST, port: value.PORT, baseUrl: value.APP_BASE_URL },
    auth: { sessionSecret: value.SESSION_SECRET, password: value.AUTH_PASSWORD },
    llm: {
      ...(value.LLM_API_KEY !== undefined ? { apiKey: value.LLM_API_KEY } : {}),
      ...(value.LLM_MODEL !== undefined ? { model: value.LLM_MODEL } : {}),
    },
  };
}
