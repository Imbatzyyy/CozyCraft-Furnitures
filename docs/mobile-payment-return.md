# Mobile payment return repair (mobile 1.0.79)

The deployed checkout creator previously ignored the native client's
`mobileReturn: true` and always created website return URLs. Existing provider
sessions retain those original destinations, so changing creation alone cannot
repair a resumed legacy/web-created session.

## Routing

1. The authenticated checkout creator selects fixed server-owned return URLs:
   native clients use `/mobile-payment.html`; website clients keep `/payment-return`.
   Neither arbitrary return origins nor customer-provided destinations are trusted.
2. The native browser first visits the small handoff page with an order ID and
   approved PayMongo URL in its fragment. It records an exact-order one-hour browser
   preference, removes the fragment from history, and opens the unchanged session.
3. Native returns open `com.cozycraft.furniture://payment/return` with that order ID.
   A real, accessible Open CozyCraft app link remains if automatic app opening is
   blocked. The page completes loading before requesting the external scheme.
4. If an existing session returns to `/payment-return`, the website startup guard
   checks the exact-order preference before mounting React. Matching returns use
   the same app handoff. Unmarked/different/expired website orders remain website
   payments. Missing/blocked storage must not interrupt ordinary web checkout.

The static page has no payment API, auth-session dependency, analytics or database
polling. Its marker is not authorization or payment proof. Provider webhooks and
authenticated app reconciliation still determine payment status. No deadline,
order total, reward, inventory or payment authorization rules were changed.
Legacy redirect-only Edge Function links now also use the correct `/return` URI;
their provider fetch has an eight-second timeout.

## Release order and verification

Publish the website assets/guard first, then deploy only the patched live-source
`create-paymongo-checkout` and `mobile-payment-return` functions. Do not replace
the shared backend with the older mobile-repository implementation. No migration.

`npm run verify` passes 610 tests plus TypeScript/build. This includes 11 focused
return routing and static-page tests. Run `scripts/audit-mobile-payment.mjs` after
building; set `PLAYWRIGHT_MODULE` to the installed Playwright module if necessary.
It exercises 16 Chromium/WebKit responsive/new/legacy cases with hosted-checkout
fixtures, preserving the actual order/session and checking zero Supabase calls on
the legacy app return. Physical-device PayMongo payment remains a separate check.
