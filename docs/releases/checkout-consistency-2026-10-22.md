# Cart consistency and safe checkout

Scope: website cart concurrency, distinct-product badges, shared checkout policy,
card sandbox guidance, and real catalog popularity. Mobile application source is
unchanged; shared backend policy covers its existing checkout RPCs.

## Policy

- At most 10 distinct products, 10 units per product, 20 units total.
- Final payable amount (delivery minus valid rewards): PHP 500,000 maximum.
- COD: PHP 20,000, including existing unpaid COD exposure; GCash: PHP 100,000.
- At most 5 new orders/account/5 minutes and 3 recent pending online orders.
  Existing idempotent retries do not create orders or consume another slot.
- Web checkout confirms the displayed amount atomically before committing stock
  or voucher reservations. Mismatch rolls back the whole transaction.
- Existing orders remain settleable and fulfillable without retroactive caps.

## Cart and performance

- Ordered per-account writer, 180ms coalescing, functional quantity updates,
  stale-read tokens, account isolation, explicit failed-save retry.
- Exact money values, including centavos; no animated payment totals.
- Disable checkout while cart changes are pending/failed. Warn before leaving
  with unsaved edits. Guard double submission and edits during OTP/placement.
- Header/mobile/profile badge counts distinct products. Cart retains piece count.
- Popularity uses unique signed-in product viewers already recorded by web/mobile;
  likes use current wishlist saves. Repeated views update recency, not rank.
- Transactional compact counters; public RPC exposes no customer identities.
  60-second in-memory reuse, no polling, no extra product-photo downloads, and
  popularity requests do not delay the initial catalog render.

## Payment validation

- Verified official PayMongo test-card documentation:
  https://docs.paymongo.com/docs/payment-acceptance-testing
- Only authenticated server-confirmed test-key configuration reveals sandbox
  instructions. No keys returned and configuration requests create no orders.
- Payment remains pending until a verified provider settlement, never a redirect.
- Hosted card/3DS success and decline need a user-run PayMongo sandbox checkout;
  no new real or sandbox provider payment was submitted during this release.
- Existing database audit found one paid test card payment, 20 expired and one
  failed attempt; expiry alone does not diagnose the original payment rejection.

## Release procedure

1. `npm run verify:release`, browser fixtures, Deno checks on changed entrypoints.
2. `node scripts/release-checkout-consistency.mjs` rehearses with rollback.
3. `node scripts/release-checkout-consistency.mjs --apply` applies ONLY
   `20261022150000_checkout_consistency_and_popularity.sql` atomically.
4. Deploy `create-paymongo-checkout` and `verify-mobile-payment` (shared normalizer).
5. Publish verified Vite output to the already-linked Netlify production site.
6. Confirm hosted asset hashes, routes, compact counters and applied migration.
7. Push reviewed changes; check CI.

The previously pending unlimited-GCash migration was never applied and is
superseded. The manifest records the pre-existing mobile-signed-updates migration
whose SQL was compared with the already-applied backend record; it is NOT applied
again by this release. Unrelated local security/Pro plan notes are excluded.

## Verification boundaries

- Unit/component suites plus isolated PostgreSQL WASM rollback/access tests.
- Headless Chromium at 320/390/768/1440px: rapid click bursts, at most one write in
  flight, exact totals, failed-save retry, badge semantics, checkout eligibility,
  sandbox help, no horizontal overflow. External APIs fully stubbed.
- Existing admin and storefront browser regression suites.
- No physical iPhone/Android or real bank/wallet charge proof; do not describe
  fixture/provider event tests as a live payment or multi-user database load test.
