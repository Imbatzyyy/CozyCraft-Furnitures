# CozyCraft readiness release — 11 October 2026

## Release boundary

This release fixes the audited payment webhook, unpaid online fulfillment,
shared-network discovery limits, lazy error reporting, transactional email
reliability, report environments, and release verification. It does not claim
physical-device coverage, real-money settlement, guaranteed inbox delivery, or
a measured 45-browser capacity result.

## Verification recorded for this release

- Local `verify:release`: TypeScript/build passed, 620 application tests across
  99 files, 20 Edge Function tests plus eight steps, isolated PostgreSQL
  regressions, and the 132-version migration hash manifest passed.
- Full and production-only npm dependency audits reported zero vulnerabilities.
- Rollback-only live-schema rehearsal passed before the three new migrations
  were committed. The four changed/new Edge Functions were deployed.
- Live checks confirmed the payment guard and worker cron are installed;
  anonymous credentials cannot claim email jobs or reserve discovery budgets.
  Invalid webhook signatures and personal-data finder requests were rejected.
- No historical messages were queued by the migration. Two pre-existing
  delivered/unpaid online orders remain unchanged for authorized staff review.
- Report controls were inspected at desktop, 390px and 320px widths with
  explicitly labelled local fixture data. Full amounts fit without horizontal
  overflow at 320px after the responsive adjustment. This is not authenticated
  production-admin or physical-device proof.
- Frontend publication: Netlify deployment `6acb3e4be7e622444e54098c`.
  The GitHub Actions run and production smoke results are checked at handoff.

## Shared database ownership

The website and mobile app share project `gwjsivqksyimuabbdyqq`. The three
previously applied mobile migrations dated 20260910100000, 20260910110000 and
20260924090000 have been copied byte-for-byte into this release's history.
The mobile application checkout is unchanged. Never reapply these migrations
or repair their recorded versions. The manifest includes the complete known
history with SHA-256 hashes; coordinate new versions between both repositories.

## Safe release order

Netlify runs the full release verification command on builds. The owner
authorized GitHub workflow publishing. `.github/workflows/readiness.yml` runs
the same checks on main pushes and pull requests, with read-only permissions
and isolated fixtures instead of production credentials.

1. Run `npm ci` and `npm run verify:release`. All provider calls in tests are
   fixtures; SQL runs in an isolated in-memory PostgreSQL. These are not load tests.
2. Set `COZY_SUPABASE_CLI` to the installed CLI if it is not on PATH. Run
   `npm run release:database` to rehearse only this release's three migrations
   in a rollback-only transaction against the linked schema. It creates no
   committed orders, notifications, or schema changes.
3. Deploy `transactional-email-worker` before applying the queue migration.
4. Run `npm run release:database -- --apply` once. It applies the three new
   migrations atomically and records their versions. Do not use migration
   history repair or a broad database reset.
5. Deploy `paymongo-webhook`, `furniture-discovery` and `send-transactional-email`.
6. Publish the tested frontend, verify the live assets and routes, and push.
7. Confirm the transaction email cron is active and worker claims are denied
   to anonymous and customer credentials. Check live schema and migration count.

## Rollback and recovery

Keep the preceding Netlify deployment available. Frontend rollback is safe:
the old notification endpoint is retained and deduplicates via the new queue.
Do not remove the payment guard to work around bad historical records. Do not
drop queue tables or delete email logs. If the provider is unavailable, jobs
remain queued, retry with a stable provider idempotency key, and stop before
the provider's 24-hour deduplication window ends. Staff review exhausted jobs
in Content > Email log. Sent means provider acceptance, not inbox delivery.

If a worker regression occurs, pause only `cozycraft-transactional-emails` and
its immediate-dispatch trigger while preserving pending jobs; repair and
redeploy before resuming. Coordinate an emergency database change with the
owner. Never restore a backup over production as a test.

Before final sign-off, restore a recent database backup into a separate project,
restore private/public Storage objects using a separate object backup, and
verify customer ownership, admin/MFA rules, order totals and deployed functions.
Record backup time, restore duration and the recovered transaction cutoff.
No paid plan, backup purchase, CAPTCHA activation, or credential change is
automated by this release.

## Metrics and historical exceptions

- Overview sales exclude PayMongo test payments; operational queues still show
  all records. Reports offer Live payments & COD, PayMongo test, and All records.
- Reports use order-created date in Asia/Manila. Forecasts keep eligible
  settlement dates, excluding PayMongo tests. COD has no automatic test flag.
- Older online orders already delivered with pending payment remain intact and
  appear as overview warnings. Review each provider record; do not fabricate
  payment confirmation or rewrite fulfillment history.
- Browser-error monitoring covers authenticated reports received by the server.
  Zero reports is not proof that all browsers are healthy.

## Final-day acceptance rehearsal

Use a separate staging project, payment test keys, and 45 individually verified
customer accounts plus the actual staff roles. Verify SMTP limits first. Do not
share passwords or use one customer account for all students. Test some fresh
signups/OTPs separately with permission for the email/SMS traffic.

Run 20–30 minutes of mixed real-browser use: browse/filter, cart, wishlist,
address changes, rewards, checkout, tracking, support and admin fulfillment.
Include shared school Wi-Fi, narrow iPhone/Android viewports, keyboard use,
Chrome/Safari/Firefox, reconnection, refresh and fresh administrator login.

Mandatory correctness checks:

- Customer A cannot read/update customer B's orders, addresses or vouchers.
- Last-stock competition cannot oversell. Duplicate checkout does not duplicate
  the order, payment settlement or voucher deduction.
- Successful payment settles with the browser closed; replayed webhook does not
  repeat effects. Cancelled/expired sessions release stock only after provider
  confirmation. Unpaid card/GCash orders cannot advance.
- Provider 429/timeouts leave notification jobs recoverable without undoing
  successful orders. Distinct packed/shipped events remain distinguishable.
- Fresh admin login loads data without a manual refresh; selected queue filters
  stay selected when a new order arrives.

Record p50/p95 request latency, error counts, Realtime update lag and connection
counts, database CPU/memory, egress delta, and email/AI limits. Suggested gates:
p95 <2 seconds for ordinary API reads and <3 seconds for realtime visibility,
zero data-isolation failures, duplicate business effects, overselling, or stuck
loading. External provider timings are measured separately. A failed gate blocks
readiness sign-off; a passing unit suite does not override it.

The authenticated AI search allowance is 15 uncached requests/account/10 minutes,
300/shared network/10 minutes and 500 globally/day. Guests retain 15/IP/10 minutes.
This admits 45 ordinary signed-in users on one Wi-Fi but is not unlimited AI use.
