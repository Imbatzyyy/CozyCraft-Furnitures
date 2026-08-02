# CozyCraft security notes

## Supported deployment

CozyCraft is a client-rendered Vite single-page application deployed as static
assets on Netlify. Server-side operations run in Supabase Edge Functions and
PostgreSQL with row-level security. The application does not enable React
Server Components, React Router framework mode, server actions, SSR,
prerendering, or `ScrollRestoration`.

## Dependency audit disposition

`react-router-dom` is pinned to 7.18.2. This release fixes the client-side
redirect and XSS advisories affecting earlier versions. As of 2026-08-02, npm
still reports a high-severity advisory against 7.18.2 for React Router's RSC
mode. That execution path is not present in this application. Downgrading to
7.11.0 would reintroduce multiple advisories that do apply to browser routing,
so it is not an acceptable mitigation.

This exception must be revisited when a release newer than 7.18.2 becomes
available. Production builds continue to run automated tests and the Vite
build. Run `npm run audit:prod` during dependency reviews and evaluate findings
against this deployment model rather than applying forced breaking downgrades.

## Reporting

Do not open a public issue containing credentials or customer information.
Report security concerns privately to the project owner. Rotate any credential
that is accidentally exposed in a screenshot, commit, log, or support ticket.
