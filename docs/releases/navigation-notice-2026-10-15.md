# Storefront navigation / connection notice — 2026-10-15

## Cause and fix

The homepage uses a fixed transparent header over its hero. The cached-catalog/offline notice previously rendered at the top of the normal document flow, directly underneath that header. A failed catalog refresh could therefore make its text appear behind navigation links. Standard headers were also partially translucent.

The shared storefront layout now reads one connection snapshot for both the header and notice. When offline or showing saved catalog data, the header uses an opaque sticky surface in normal document flow, so the notice follows the actual header height, including an optional store announcement. Healthy homepages retain their immersive hero navigation. Standard/scrolled headers are fully opaque.

The subscription uses existing catalog and browser events plus `pageshow` restoration. No database schema, data, request rate, polling, cache lifetime or retry behavior was changed. The existing notice and retry remain available; the fix does not suppress warnings about potentially stale prices or stock.

## Verification

- Nine new tests cover initial saved data, asynchronous failure/recovery, offline/online state, page restoration, retry behavior, announcement height, ordinary pages and cleanup.
- Full release suite passed: TypeScript, 100 test files / 638 tests, production build, database regression checks, 20 Edge Function tests / 8 steps, 133-entry migration manifest, and production dependency audit (zero known vulnerabilities at verification time).
- Local browser QA used the actual Layout/Header with isolated content. At the top of the page, header bottom and notice top matched at 77 px without an announcement and 113 px with it.
- Desktop 1440 px, mobile 390 px and narrow 320 px had no horizontal page overflow. Mobile menu, Escape close and search opening worked with the notice visible. Healthy-mode recovery restored the fixed hero header with no notice.
- Browser viewport checks are not exhaustive physical-device or Chrome/Opera/Safari certification. No network outage was intentionally introduced to production.

Reproduce without changing production data: `node scripts/preview-navigation.mjs`, then open `http://127.0.0.1:5176/`. The preview is not a production route or included in the app bundle.

Rollback: redeploy the previous frontend build. No database rollback is required.
