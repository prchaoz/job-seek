import type { StatusSource } from './status.js';

/** Runtime dependencies for the served application. SSG builds have none. */
export type WebDependencies = Readonly<{
  status: StatusSource;
  now: () => Date;
}>;

export type AppOptions =
  | Readonly<{ mode: 'ssg' }>
  | Readonly<{ mode: 'serve'; deps: WebDependencies; isProduction: boolean }>;

export type AppEnv = {
  Variables: {
    deps: WebDependencies;
  };
};

/** True for requests issued by htmx (expecting a fragment, not a page). */
export function isHtmxRequest(headers: Headers): boolean {
  return headers.get('HX-Request') === 'true';
}
