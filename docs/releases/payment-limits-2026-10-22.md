# Checkout payment limits — 22 October 2026

## Rules

- COD: final payable total <= PHP 20,000. Include delivery and subtract valid vouchers.
- Each customer's open, unpaid COD orders share the same PHP 20,000 ceiling. Paid, refunded, cancelled, or delivered orders release this exposure.
- A configured lower COD limit is respected. Zero or a larger configured value cannot bypass the hard ceiling.
- GCash: <= PHP 100,000. Card: < PHP 10,000,000. Wallet/bank/provider restrictions still apply.
- Existing orders remain settleable and fulfillable; status-only updates are not retroactively rejected.
- Disabled methods retain a reason. Invalid selections are cleared, never replaced automatically.

## Shared database release

Project `gwjsivqksyimuabbdyqq`; only migration `20261022010000_checkout_payment_limits` was deployed.
The release script first rehearsed the migration in a transaction and rolled back, then explicitly applied it.
Live readback verified COD=20000, both triggers enabled, the deferred final-total guard, one migration-history entry, the compact aggregate index, authenticated RPC access, and anonymous RPC denial (HTTP 401 / 42501).

The matching website checkout/admin copy was published to https://www.cozycraftfurnitures.com through Netlify deploy `6ad97262d55d46560331b67a`, avoiding disagreement with the new shared settings. This was a direct build deployment, not a repository push.

The private order creator takes a per-customer transaction advisory lock before inventory locks. Final constraints run after atomic voucher application and reread the final order row. Rejection rolls back the order, stock reservation, cart deletion and voucher application.
The new `get_checkout_payment_policy()` RPC returns only the authenticated customer's numeric policy/exposure summary. The UI requests it once per checkout or explicit retry, not on a poll or through an order-row subscription.

## Verification

- Website typecheck/build and 721 tests passed.
- Database fixture tests passed: inclusive/exclusive amount boundaries, delivery, voucher qualification/rollback, inventory/cart rollback, exposure, idempotent retries, legacy settlement, and access grants.
- Existing readiness and forecast database suites passed.
- Edge Functions: 21 tests and 10 nested steps passed, including signed payment webhooks and replay protection.
- Migration manifest contains 134 unique versions and matches file hashes.
- Published index, checkout bundle and admin-settings bundle returned HTTP 200 and matched the local release bytes exactly.
- Production dependency audit reported zero vulnerabilities. The first full release-verification command reached the audit but exited on an npm registry timeout; a bounded retry of that audit succeeded.

The database fixture runs PostgreSQL in isolated PGlite, not a multi-connection load test. No live customer order or charge was created for validation. Real payment authorization and physical-device installation remain separate acceptance checks.

## Commands

`node scripts/test-payment-limits-db.mjs` is also included in `npm run test:db`.
`node scripts/release-payment-limits.mjs` rehearses only this migration; `--apply` commits it. It intentionally rejects repeat application instead of overwriting history.

## Website follow-up verification

- Reviewed the current mobile storefront implementation read-only; no mobile application files were changed.
- Added real Checkout component tests for the inclusive COD boundary, delivery, voucher changes, unpaid COD exposure, loading/failure states, retry, and explicit customer payment selection.
- Added a 12-second deadline for the read-only COD policy request, cancellation on account change/unmount, strict response validation, and tests proving there is no periodic polling or stale-account response reuse.
- Clarified the submit label when COD is unavailable but online payment methods remain available.
- Final website verification: typecheck, 106 test files / 737 tests, and production build passed. The existing HEIC converter chunk-size warning remains; it is unrelated to checkout.
- Extended isolated PostgreSQL coverage to the website's actual `place_order_with_reward` wrapper, including voucher-adjusted totals, idempotent retry, and inventory/cart/voucher rollback.
- Database suites, 21 Edge Function tests with 10 nested steps, and production dependency audit passed (zero reported vulnerabilities).
- Responsive fixture inspection at 320, 390 and 1440 CSS pixels found no horizontal content overflow. This used the real Checkout markup with fixture data, not a live purchase.
- The staged release snapshot matches all 134 migration hashes. The unrelated local mobile-update migration and existing operations-document edits are intentionally excluded from this website release.
- The shared database policy was verified already active; it was not applied again.
