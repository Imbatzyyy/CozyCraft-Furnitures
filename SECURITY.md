# CozyCraft security notes

## Supported deployment

CozyCraft is a client-rendered Vite single-page application deployed as static
assets on Netlify. Server-side operations run in Supabase Edge Functions and
PostgreSQL with row-level security. The application does not enable React
Server Components, React Router framework mode, server actions, SSR,
prerendering, or `ScrollRestoration`.

## Database authorization

All tables exposed through Supabase's `public` schema have row-level security
(RLS) enabled and forced. Policies are ownership-based: customers can access
only their own profile, addresses, cart, wishlist, orders, payments,
notifications, support tickets, and related records. Public visitors can read
only the active storefront catalog, approved reviews, categories, and public
store settings. Staff operations are authorized by protected database helper
functions and role checks.

Table and column grants are intentionally narrower than the RLS policies.
Customers cannot update their role, staff status, order totals, payment IDs, or
other privileged fields even if a client request is modified. Sensitive
database procedures live in the unexposed `private` schema; public RPC wrappers
run as the caller and payment-settlement procedures are executable only by the
server-side `service_role`.

Supabase Storage buckets containing avatars, return evidence, and support
attachments are private. Product catalog images are public by design because
they must be delivered to storefront visitors.

## Keys and secrets

Only `VITE_SUPABASE_URL` and the Supabase publishable key may be included in the
browser bundle. The publishable key identifies the project but does not bypass
RLS. Never place a Supabase secret/service-role key, PayMongo secret key,
webhook secret, Resend API key, or AI provider key in a `VITE_` variable,
frontend source, Git commit, screenshot, browser storage, or client response.

Privileged keys belong only in Supabase Edge Function secrets. User-facing Edge
Functions require a valid Supabase JWT; intentionally public webhooks and public
lookup endpoints must authenticate requests using their own provider-specific
controls where applicable. Rotate a privileged key immediately if it is ever
exposed.

Local environment files and Netlify state are ignored by Git. Keep
`.env.example` limited to placeholder names and never real values.

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
