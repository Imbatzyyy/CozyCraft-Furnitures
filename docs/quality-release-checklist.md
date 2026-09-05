# Storefront and admin quality release

## Changes

- The admin overview requests `admin_overview_snapshot` rather than every order's payment and tracking history. Totals are calculated in PostgreSQL, using Philippine month boundaries. Loading and failure are distinct from a real zero total.
- The order desk uses `admin_order_queue`: server-side search, filters, stable ordering and five orders per page. Summary counts cover the full matching dataset, not just the visible page. The existing realtime subscription invalidates this data without changing filters or reloading the document.
- The browser coalesces realtime bursts and debounces search. Focus refresh is throttled; no continuous polling is introduced. Reports and payments retain their existing full-record queries; this release does not claim those screens are server-paginated.
- Order-status changes compare the stored status with the version the administrator saw. A conflict refreshes the queue and does not send a fulfillment email.
- Catalog quality checks use already-loaded data. Product diagrams use actual stored measurements; the footprint checker converts supported units to centimetres and declines ambiguous values.
- Order support preselects the related order. Private, append-only handover notes are stored separately from customer replies, checked by RLS and loaded only when their panel is opened (latest 20 notes).
- Mobile input text is at least 16px to avoid Safari's focus zoom. Existing safe-area navigation and focus styling are preserved.

## Verification

Run `npm run verify` and `npm run audit:prod`.

`node scripts/test-admin-read-models.mjs` tests both migrations in a rolled-back transaction against the linked Supabase project. After release, set `TEST_DEPLOYED_SCHEMA=1` to test the installed functions and table instead. It checks totals, pagination, Philippine dates, payment filters and staff/customer authorization. Synthetic notes are rolled back; existing customer records are not changed.

Browser regressions use isolated Chrome contexts and simulated API responses. Set `PLAYWRIGHT_MODULE` to an installed Playwright module if necessary:

- `node scripts/test-admin-login.mjs`: fresh login, MFA, compact overview, five-row pages, stable Today view, conflicting status updates and private handover notes/draft preservation.
- `node scripts/test-storefront-quality.mjs`: 360/390/768/1440px product layout, accurate unit conversions, diagram and room-fit feedback.
- Set `TEST_BASE_URL` to test the deployed frontend with the same isolated API fixtures.
- `npm run smoke:prod`: public production routes and security headers.

## Release order

Apply the two additive database migrations before publishing the frontend. Confirm the actual production deploy is ready, rerun database assertions, browser regressions against the deployed assets, and production smoke tests. Never expose service credentials in frontend code.

## Remaining real-device acceptance checks

Browser fixtures and unit tests are not a real payment-provider test. Before the class demonstration, rehearse a test-mode PayMongo checkout/back/return journey, COD, a fresh authenticated session, and an actual iPhone Safari session. Do not charge real customers or send SMS/email solely for regression testing.
