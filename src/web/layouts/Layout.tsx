import { jsxRenderer } from 'hono/jsx-renderer';

import { Nav } from '../components/Nav.js';

export type PageProps = { title?: string; currentPath?: string };

declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string>, props?: PageProps): Response | Promise<Response>;
  }
}

/**
 * Renders every page inside the shared document shell with a DOCTYPE.
 * Routes call `c.render(<Content />, { title, currentPath })`.
 */
export const layoutRenderer = jsxRenderer(
  ({ children, title, currentPath }) => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{title ? `${title} · Job Agent` : 'Job Agent'}</title>
        <link rel="stylesheet" href="/assets/app.css" />
        <script src="/assets/htmx.min.js" defer></script>
      </head>
      <body class="min-h-screen bg-slate-50 text-slate-900">
        <Nav currentPath={currentPath ?? ''} />
        <main class="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  ),
  { docType: true },
);
