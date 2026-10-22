# Admin orders and payments exports - 22 October 2026

## Delivered workflow

- Orders and Payments each offer an Export report dialog with branded PDF or spreadsheet CSV.
- Start with the page filters or reset to all records. Filter fulfillment status, payment status, COD/GCash/card, order-created date (including custom inclusive Philippine dates), search, saved queue, and payment environment.
- Customer name, statuses, dates, amounts, and environment are included. Email/phone, delivery address, and order products/quantities/prices are opt-in.
- Payments now has method, payment status, order status, and date filters directly on the page. Summary cards and exports use the same filtered server data.
- PDF reports follow CozyCraft's ivory/charcoal/olive design, with logo, metadata, financial summary, wrapped rows, repeated headings, and page numbers. Normal orders remain with their detail lines. CSV escapes spreadsheet formulas and includes a UTF-8 BOM.
- One payment record is reported per order; the most recent settled provider record is preferred over a newer pending attempt. This is an order-payment report, not a ledger of every checkout attempt.
- Settled sales exclude cancelled orders and follow the chosen live/test/all scope. Each record names its environment. Missing provider payment dates remain unrecorded rather than being invented.

## Architecture and access

`20261022120000_admin_commerce_exports.sql` adds only the `admin_commerce_report_page` read function and its narrowly scoped execution grant. It uses SECURITY INVOKER and existing RLS, staff/session/MFA gates; payment reporting additionally requires administrator access. Anonymous execution is denied.

Exports load compact batches of 250 using a created-date/ID cursor and fixed creation cutoff. A fingerprint/count check detects changing selected orders between batches; errors, duplicates, incomplete results, and oversized reports do not silently produce a partial file. Maximum export size is 5,000 PDF rows or 50,000 CSV rows; larger reports require narrower dates/filters. On-demand exports add no background polling. Optional personal/product details are fetched only when selected. PDF code is dynamically loaded.

The shared migration was rehearsed against the live schema in a rolled-back transaction. Read-only queries through an existing active admin session verified all-order counts/settled totals, pending COD counts, and the optional detailed row structure. No order, payment, inventory, authentication-session, or customer record was changed by that verification.

## Verification

- Clean staged release: typecheck, 108 files / 747 automated tests, and production build passed.
- All database suites passed, including 261-row equal-timestamp cursor coverage, all fulfillment and payment combinations, environment scope, Manila midnight boundaries, latest settled reference, optional details, snapshot changes, and staff/admin/MFA/invoker checks.
- Edge Functions: 21 tests and 10 nested checks passed. Production dependency audit reported zero vulnerabilities. Migration manifest validated 135 unique versions.
- Full browser regression suite passed. New authenticated fixtures tested real CSV/PDF downloads at 320, 390, and 1440 pixels, applied custom/status/method filters, and checked horizontal overflow.
- PDF previews were rendered and visually inspected. Text extraction verified all 36 fixture records and repeated logos/page numbers across the generated multi-page documents.
- The deployable website was built from a clean staged snapshot. Pre-existing GCash/mobile-update work and operations-note changes were preserved and excluded.

Commands: `node scripts/test-commerce-reports-db.mjs`, `node scripts/preview-commerce-reports.mjs`, and `node scripts/release-commerce-reports.mjs` (rehearsal; `--apply` deploys exactly this migration). The release command accepts `COZY_SUPABASE_CLI` and `COZY_SUPABASE_WORKDIR` for an already linked checkout.
