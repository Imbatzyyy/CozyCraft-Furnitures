# Realtime and bounded-read release

## Scope

This release changes website reads and refresh coordination. Existing checkout,
payment, OTP, stock-reservation and loyalty-write rules remain server-authoritative.
No mobile application files are modified. Database additions preserve existing RPCs.

## Read and recovery contract

| Surface | Initial / active read | Realtime and recovery |
| --- | --- | --- |
| Catalog | Initial product snapshot in stable 500-row chunks | Compact availability signals trigger 50-ID batches. Reconnect/focus compares ID/version manifests. Full settings/category refreshes are exceptional. |
| Customer orders | Five order graphs, global counts, at most one separately focused owned order | Coalesced invalidations; late identity/filter/link results are ignored. Direct older-order links remain supported. |
| Support | Ten tickets and exact total | Coalesced refresh; admin reply drafts belong to ticket IDs, not list positions. |
| Public reviews | Five filtered reviews | Product-scoped channel; purchase eligibility uses an independent owner-bound read, not the loaded order page. |
| Admin reviews | Ten reviews and aggregate counts | Current page only, including photo/avatar signing. |
| Admin members | Twenty members and aggregate tier/balance totals | Selected detail has bounded activity/rewards and late-selection guards. |
| Admin payments | Twenty compact rows and global paid totals | Full CSV is an explicit bounded-batch export with an as-of cutoff. |
| Admin activity | Twenty/fifty/one hundred summaries, last seven days | Server-side search/filter; large stacks and arbitrary detail objects omitted. |
| Operations health | Aggregate counts and latest thirty errors | Visible-page recovery; job health exposes only queue counts. It is not an all-systems availability guarantee. |
| Home Circle / wallet | Existing compact snapshot / six vouchers | Owner-filtered subscriptions while mounted/active; recover on reconnection or visible return. |
| Notifications | Customer latest twenty plus unread count; admin latest one hundred plus their read states | Coalesced refresh and identity-safe publication. Not a full notification archive. |

Read coordinators retain invalidations arriving during an in-flight read. Catalog
snapshots and targeted patches serialize their publication. Focus, reconnect and
visibility events reconcile missed updates without continuous polling. Visibility
recovery uses a thirty-second freshness threshold; explicit updates are not held
for thirty seconds. Debounce windows are normally 150–300 ms and bounded.

These mechanisms reduce redundant work; they do not guarantee instantaneous
delivery on disconnected clients or eliminate provider/network latency.

## Image delivery

Only public product-images URLs are eligible for Netlify image transforms, with
320/640/960/1440-pixel variants. Signed/private avatars, reviews and attachments
are excluded. A failed transform falls back to the original URL. Fullscreen zoom
uses the original image. Product cards no longer cycle through every photo.

This reduces repeated origin downloads and transfers delivery to Netlify's CDN;
it does not mean zero egress or free/unlimited image delivery. Compare both
providers' usage after release. Existing HEIC conversion remains a large lazy
chunk and is not represented as optimized away.

## Verification and release order

1. `npm run verify`, `npm run audit:prod`, Edge boundary tests, diff and secret checks.
2. `node scripts/test-architecture-read-models.mjs` against the named disposable
   PostgreSQL container only; fixture database is dropped after the test.
3. `node scripts/verify-architecture-live.mjs --rehearse`: new definitions and
   synthetic Auth sessions are transactionally rolled back; only assertions
   are returned. `--management-api` supports an existing access token supplied
   through the environment if the CLI transport is unavailable.
4. Apply only migrations 20260925100000, 20260925110000, 20260925120000 and
   20260925130000. Do not repair or replace migration history from other clients.
5. Repeat live role checks without `--rehearse`, then publish the matching build.
6. Check production routes, image transform output, public desktop/mobile layouts,
   and local/remote Git commit equality.

Automated assertions do not replace a controlled customer/admin browser session,
physical iOS/Android testing, paid checkout, or email/SMS delivery verification.
Use test accounts and provider test modes for those checks; do not create real
customer orders merely for release verification.

## Remaining owner-operated work

- Activate `docs/security-workflow.yml` as `.github/workflows/security.yml` using
  an owner-authorized GitHub credential with workflow permission. The currently
  connected OAuth credential does not have that scope; CI is not claimed active.
- Run an isolated backup restore drill, including storage objects. Never restore
  over production as a test. Record recovery time and order/ownership checks.
- Configure billing/usage alerts and incident recipients in provider accounts;
  agree thresholds based on actual traffic and the selected plan.
- Review provider MFA, least privilege and separately approved paid protections.
- Compare Supabase database/storage/realtime egress and Netlify image usage over
  equivalent traffic windows; do not infer monthly savings from a single test.

For rollback, republish the previous compatible frontend first. These read RPCs
and indexes are additive and can remain in place. Do not delete customer data,
rewrite migration history, or disable security policies to recover a release.
