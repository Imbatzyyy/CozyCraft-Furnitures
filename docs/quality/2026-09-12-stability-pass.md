# Website stability and mobile-parity implementation

Date: September 12, 2026. Scope: CozyCraft website only. This report records pre-release implementation verification. No production data mutation, payment, or outbound test email was performed. Subsequent publication is recorded in the Git and Netlify release histories.

## Implemented

- Resilient local/session storage adapters prevent blocked browser storage from crashing initialization and preserve failed removals instead of reviving stale values.
- The customer remember-me control selects persistent or tab-scoped session storage. Administrator authentication remains separate.
- `/forgot-password` opens the recovery form directly. Recovery submission has duplicate-request protection, a pending state, and visible failure feedback.
- Pending email changes are account-scoped and expire. Checks run on relevant return/connection events rather than a five-second interval; stale account responses are ignored.
- Public help requests are deduplicated, cached, and protected against stale route responses. Missing or failed data has retry feedback; cached data is labeled when the live request fails.
- Public catalog snapshots expire after seven days. A connection/stale-data notice and retry action accompany degraded browsing. Checkout is blocked while explicitly offline; no offline order writes are queued.
- Admin content loads/subscribes only to its visible section. Unsaved records survive live refresh, and same-tab account-scoped draft recovery lasts up to 24 hours where storage is available.
- Admin content saves use database timestamps to reject stale overwrites; concurrent duplicate saves are guarded. New banners use INSERT. Source-managed legal policies are not presented as editable database-backed public pages.
- Profile communication preferences use the existing mobile-app customer_preferences table, explicit Save, opt-in promotional defaults, owner-scoped reads, realtime updates, and a short cache.
- Browser text-size options are available in Profile. Profile/review uploads accept HEIC/HEIF through lazy local conversion with validation and preparation feedback.
- Legacy dialogs gain keyboard containment and focus restoration. Existing native dialogs retain their own handling.
- Cookie/storage disclosures describe the new public caches and text-size setting. The HTTP smoke script now explicitly states it cannot verify JavaScript route rendering.

## Verification

- `npm run verify`: passed TypeScript, **405 tests across 70 files**, and the production build.
- `npm audit --audit-level=moderate`: **0 known vulnerabilities**, including development dependencies, at verification time.
- `git diff --check`: passed.
- New regression tests cover storage denial, session retention, account switching, pending-email polling removal, stalled reads, offline writes, cached-content expiry, stale help responses, retry, preferences, dialog focus, admin draft recovery, active-section requests, and new-banner insertion.
- Local browser: direct password recovery, return to sign-in, remember-me toggle, FAQ search/expansion, and mobile-menu Escape/focus restoration. Checked phone widths 320/390px and desktop 1280px with no document-level horizontal overflow in those views.
- Read-only live database checks confirmed the two published help pages, RLS on relevant tables, owner-scoped preference policies including MFA restrictions, and automatic updated_at triggers used by content conflict detection.
- Mobile application repository remained clean and unchanged.

## Remaining verification boundaries

- Account writes, real email/SMS delivery, OAuth redirects, payment provider flows, and actual device HEIC decoding were not exercised against customer accounts. Their local flows/contracts have tests, but those tests are not live provider certification.
- Browser checks were in the available in-app browser, not a new physical iPhone/Android or full Chrome/Firefox/Safari certification matrix.
- Offline browsing is a saved-data fallback after the site has loaded, not a service-worker guarantee that the entire app starts without a connection. Prices and availability must be revalidated online.
- HEIC conversion adds an approximately 734 KB gzipped lazy chunk. It is requested only when converting a HEIC/HEIF image, not during ordinary page loading. The build's large-chunk warning is expected for that optional decoder.
- Publication was a separate, subsequently authorized release step, not part of the initial implementation checks above.
