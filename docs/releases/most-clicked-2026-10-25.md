# Guest-inclusive Most clicked ranking

## Behavior

- One customer-facing **Most clicked** option replaces the saved-based and account-only popularity options. Existing `sort=liked` and `sort=popular` links resolve to it.
- Shared product-page opens from guests and signed-in website customers determine the order, descending by count, then product name and ID for stable ties. Cards, hover previews, wishlist saves, and reviews do not add visits.
- The same sort works in Shop all, room collections, new arrivals, and filtered/search results. Existing home/recommendation popularity consumers use the shared aggregate too.
- The existing 196 recorded account-product views across 91 products formed the genuine starting baseline at migration time. Previously unrecorded guest visits are not invented or backfilled. New website opens count under the repeat protections below. Mobile source and its recently viewed history are unchanged.

## Counting and privacy

- `record-product-visit` accepts anonymous requests intentionally; it never receives a customer bearer token or requires sign-in. Allowed origins and bounded input are validated. Only its service credential can invoke the atomic database writer.
- A memory-only per-product random request token suppresses repeat opens in the same running page for 30 minutes and is reused on retry. It is not a persistent visitor identifier. Reloading clears that memory; network/global budgets still apply. These are protected visit totals, not unique-person totals or an exact count of every raw click.
- Database event IDs are unique, so concurrent/retried delivery cannot count the same event twice. Network ceilings permit 120 opens of one product per 10 minutes, 3,000 total per hour per keyed network, and 10,000 per hour globally. Shared classroom Wi-Fi is supported; these controls are not a claim of perfect bot detection.
- No raw IP address, email, account ID, or per-account browsing history is stored by the new counter. HMAC network budget keys and random retry tokens expire after 24 hours and are cleaned hourly. Product aggregates persist; underlying tables are not publicly readable or writable.
- Cookie/storage wording explains this first-party aggregate feature. No analytics cookie or cross-site tracker was added.

## Performance and failure behavior

- One compact aggregate RPC, shared concurrent requests, a 60-second successful-read cache, and 15-second failure backoff. Refreshes happen on catalog/sort entry and window focus; no continuous polling or raw history download.
- Accepted visit responses update the current product count and invalidate the aggregate cache. A slower in-flight read cannot overwrite that newer count. Cross-device changes appear on the next eligible aggregate refresh, not as a guaranteed instant push.
- Visit writes are background-only with a five-second client deadline. Failures do not block browsing, authentication, carts, or checkout. Existing recently viewed history stays separate. Malformed guest history no longer causes an unhandled rejection in this path.
- The legacy `catalog_popularity()` RPC and account-only viewer/wishlist triggers remain intact for older clients.

## Verification

- `npm run verify:release`: 788 tests in 113 files, production build, database suites, 24 Edge tests plus 10 steps, migration manifest, and production dependency audit.
- New isolated PostgreSQL tests cover the baseline, duplicates, 45 shared-network visitors, rate ceilings, hidden/missing products, legacy RPC compatibility, and anonymous/authenticated access restrictions.
- New browser journeys cover guests/accounts at 320, 390, 768, and 1440 pixels, contradictory saves versus visits, global/room ordering, legacy links, non-counting card render, return navigation, repeat suppression, and horizontal overflow.
- The exact additive migration was rehearsed with rollback before applying. Live read-only checks confirm aggregate access and denial of raw counter reads/direct public writes. Invalid-product and invalid-origin Edge probes do not inflate live counts.

## Release operations

`node scripts/release-catalog-visits.mjs` rehearses only the reviewed migration; `--apply` commits it. It validates the project, grants, baseline and scheduled cleanup. Credentials remain in the environment or existing CLI keychain, never source or command arguments. Deploy only `record-product-visit` before releasing the frontend.

Rollback the frontend if necessary; the additive database objects are backward compatible and should not be destructively dropped or reset. Reverting the UI alone does not stop background counting in browsers already running the new bundle.
