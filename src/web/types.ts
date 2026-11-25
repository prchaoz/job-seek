import type { AuthConfig } from './auth.js';
import type { StatusSource } from './status.js';

/** Runtime dependencies for the served application. SSG builds have none. */
export type WebDependencies = Readonly<{
  status: StatusSource;
  now: () => Date;
}>;

export type AppOptions =
  | Readonly<{ mode: 'ssg' }>
  | Readonly<{
      mode: 'serve';
      deps: WebDependencies;
      auth: AuthConfig;
      /**
       * Directory produced by `npm run build` (dist/static). When set, assets are
       * served from `<staticDir>/assets` and the pre-rendered shell pages are
       * served from disk; missing files fall back to runtime rendering.
       */
      staticDir?: string;
    }>;

export type AppEnv = {
  Variables: {
    deps: WebDependencies;
  };
};

/** True for requests issued by htmx (expecting a fragment, not a page). */
export function isHtmxRequest(headers: Headers): boolean {
  return headers.get('HX-Request') === 'true';
}
