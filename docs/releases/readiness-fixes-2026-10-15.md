# Readiness fixes — 15 October 2026

The verified website build is deployed to https://www.cozycraftfurnitures.com
(Netlify deployment `6ad0c659179145c0af399736`). The changed
`sync-paymongo-payments` function is deployed as active version **20**, with JWT
verification retained. No production orders, payments, credentials, or database
policies were edited by this release. Existing unrelated workspace edits were
preserved outside the release commit.

## Changes

- Share the compact admin overview between the overview page and sidebar.
  Refresh events are debounced with a bounded wait, never dropped because a
  previous read was recent, and queued if a request is already in flight.
  Hidden tabs defer work; foreground/online recovery refreshes without polling.
  Requests have a 12-second deadline and identity-scoped cleanup. A failed
  refresh retains the last good overview with its existing error/retry message.
- Correct payment sync's reported result: a rejected expiry RPC no longer
  increments the successful-synchronization count. The production handler
  remains behind `serveProtected`; the exported handler permits isolated tests.
- Display an explicit missing-photo placeholder instead of a `1 / 0` counter
  and an empty fullscreen-gallery action.
- Repair browser selectors for the current admin/product UI without removing
  conflict, stock, MFA, bounded-read, pagination, or responsive assertions.
  Add a self-managed localhost browser runner and include it in readiness CI.

The separate **COZYCRAFT MOBILE** checkout also contains:

- Capacitor core, CLI, Android, iOS and Swift package lock upgraded to 8.5.1,
  addressing GHSA-rvm3-566m-v7fv. Rebuilt native binaries are required; a web-only
  deployment cannot patch already-installed apps.
- Compatible Angular build tooling, Vite and Vitest patches, plus available
  nonbreaking transitive dependency fixes. Production audits now gate releases.
- An isolated Vite dependency cache for the mock QA entry, preventing it from
  contaminating the real app dev server's Supabase dependency.
- No empty `src` request from the shared product-image component.
- A repeatable Chromium/WebKit browser runner and setup instructions in
  `storefront/qa/README.md`.

## Verification

- Website: 643 tests across 101 files, TypeScript and production build passed.
- Disposable PGlite checks passed: payment/settlement replay, COD exception,
  email lease/retry isolation, 45 verified-user budgets, scoped reports, and
  classroom forecast fixtures. These are not live load tests.
- Edge functions: 21 tests and 8 substeps passed; 133 migration versions match
  the existing manifest. No new migration is required for this repair.
- Website browser fixtures: 4 admin scenarios, 2 outage/retry scenarios and
  4 product-layout/measurement scenarios passed (360–1440 px where applicable).
- Mobile: 378 storefront tests, 25 native-shell tests and 11 toolchain tests
  passed, with TypeScript, lint and backend-ownership checks.
- Mobile browser fixtures: 14 Google/email tutorial-and-voucher journeys,
  4 low-egress/recovery scenarios, 18 storage/cart/wishlist reliability cases,
  and 20 navigation/layout combinations passed across Chromium and WebKit.
- Xcode 27 iOS Simulator and unsigned generic iPhone builds passed, as did the
  Android debug APK build. The updated app launched on the existing iOS 27 QA
  simulator. Xcode resolved CapApp-SPM and all plugins. No physical installation.
- Mobile release **1.0.83**: Android versionCode **84**, iOS build **71**.
  The iOS 16 minimum is retained; the APK signature matches release 1.0.82.
- All 159 web files matched the Android/iOS bundles, iOS simulator binary and
  Android APK. APK SHA-256:
  `2a8059f8926b365b63648f3667e101b19866559752e237a3e556f62f45ec209a`.
- Runtime dependency audits: zero known findings in the website, mobile shell,
  and mobile storefront. Full website and mobile-storefront audits are also zero.
- Mock QA and real-app dev servers ran concurrently without the previous
  outdated optimized-dependency error.
- Live checks passed for 19 route shells, security headers, robots and sitemap.
  All five published entry assets match the verified local build byte-for-byte.
  The deployed function starts, responds to CORS preflight, and rejects an
  anonymous POST with HTTP 401. No live settlement or expiry was triggered.

## Explicit remaining gates

1. Install the rebuilt **1.0.83** native app for device testing. Publishing the
   website does not patch the native Capacitor version on an existing install.
2. Physically retest Google/manual signup, voucher/tour, interrupted payment
   return and notification behavior on representative iPhone/Android devices.
   Browser mocks and simulator launch do not prove provider delivery.
3. Preserve and reconcile the historical delivered/unpaid online orders using
   PayMongo evidence and an authorized staff decision. Do not fabricate payment
   confirmation or silently delete inconsistent test history.
4. Apple remote push still needs APNs credentials. Existing in-app/local
   notifications are a separate capability. Previously failed promotional
   deliveries need a provider/device delivery test before claiming success.
5. Rehearse the actual peer-testing cohort with pre-created accounts or staged
   signup. Auth/provider limits, inbox delivery, simultaneous real devices and
   restore/recovery remain operational checks, not unit-test guarantees.
6. The mobile shell's full dependency audit retains **16 development-only
   entries (12 high, 4 moderate)**, inherited from `braces`/Karma/Webpack and
   `uuid`/Xcode tooling. The current `braces` release has no patched version;
   npm's force suggestions include incompatible downgrades. Keep dev servers
   localhost-only, process trusted project inputs, and track upstream fixes.
   Do not describe the entire development toolchain as vulnerability-free.

## Repeatable checks

Website (Node 22/24):

```sh
npm ci
npx playwright install chromium
npm run verify:release
npm run test:browser
```

Mobile (Node 24, Java 21 for Android): see `storefront/qa/README.md` in the
separate mobile repository. Rebuild/sync native assets after changing runtime
dependencies, and run `scripts/verify-native-assets.mjs` after both builds.

Security reference:
https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv
