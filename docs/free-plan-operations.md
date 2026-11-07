# CozyCraft on Supabase Free

This replaces Pro-specific operational assumptions for the website. It does not
change the mobile app, commerce limits, row-level security, admin MFA, payment
verification, inventory reservations, or customer ownership checks.

## Recovery comes first

Run `node scripts/backup-local.mjs create` from the repository on the owner's Mac.
It uses the existing Supabase CLI login in macOS Keychain and HTTPS Management
API. No hosted rows or credentials are printed. The default archive includes:

- Typed table contents in public, private, auth, storage and migration schemas.
- Schema definitions, policies, grants, enums, indexes, triggers and sequences.
- The existing cron job definitions and a cutoff-bounded job-run history archive.
- Every inventoried Storage object, including private objects.

Files are streamed through gzip and AES-256-GCM into `~/CozyCraft Backups/`.
The directory is owner-only (0700); archive files are owner-only (0600).
The encrypted manifest records SHA-256 hashes and byte counts. A failed run
does not produce a completed manifest and must not be treated as a backup.
The encryption key is stored separately in macOS Keychain as
`CozyCraft local backup encryption v1`, account `cozycraft-backup`.

Before relying on an archive:

```
node scripts/backup-local.mjs verify /absolute/path/to/completed/archive
node scripts/backup-local.mjs restore-check /absolute/path/to/completed/archive
```

`restore-check` decrypts into memory, restores typed tables into an isolated
in-memory PostgreSQL-compatible database, checks row counts and relational
constraints, and then disposes of it. It never runs backed-up jobs, triggers or
emails. This is a logical-row recovery test, **not** a full hosted Supabase
disaster-recovery rehearsal. Recreating a hosted project also requires platform
configuration, Auth/provider secrets, Vault entries, Edge secrets, correct
managed-schema versions, and a reviewed schema/permission restore.

The archive is not a cross-table/Storage point-in-time snapshot. Pause writes
during a planned disaster-recovery export when strict consistency is needed.
Optional `create --native` uses a local PostgreSQL client and the official
Supabase root CA for a pg_dump archive when the network supports the direct
database endpoint. The public CA is not a secret. Source:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

**Owner action:** keep a separate, secure recovery copy of the encryption key.
Do not put it in Git, chat, this document, or alongside the archive. Losing this
Mac and its Keychain can make a local-only backup unrecoverable. Off-site storage
is deliberately not configured until the owner chooses the destination.
Run a backup before maintenance and at least weekly while the project is in use.
This is a manual procedure, not an installed unattended backup job. Monitor disk
space; never delete the last verified archive when rotating copies.
Full Storage downloads consume transfer allowance: this initial archive includes
about 324 MB of Storage data. Account for repeated full backups in the monthly
egress budget rather than scheduling them unnecessarily often.

## Bounded background work

The payment-expiry and newsletter cron schedules remain once per minute for
responsiveness, but their database guards call an Edge Function only when work
is due. Existing leases, expiry rules and provider idempotency remain intact.
An idle month avoids about 86,400 calls from these two workers compared with
unconditional once-per-minute invocation; active work still consumes calls.

Newsletter sends are limited to ten candidates per invocation, paced instead of
bursting, with a 70-second sending budget and bounded request timeouts. Deferred
messages return to the queue. Database acknowledgement failures are reported,
not counted as a completed campaign. A stale lease remains recoverable.

Hourly operational-log retention removes at most 10,000 finished rows per run:
successful runs older than 30 days, or any finished run older than 90 days.
Running jobs and recent failures remain. Orders, payments, customer activity,
inventory, messages, and Storage files are not deleted. A verified local archive
is required before applying the migration. PostgreSQL may reuse freed space;
this does not promise an immediate smaller on-disk database. Avoid VACUUM FULL
on the live store solely to make the usage graph drop.

The mobile-updates bucket cap is aligned with the Free global 50 MiB upload cap.
Existing update binaries remain available; no release file is pruned silently.

## Honest degraded service

Database REST reads have deadlines and an in-memory 30-second outage / 60-second
quota cooldown. One recovery read probes after the cooldown. No polling or
persistent lockout is introduced. Writes, checkout, and payment submissions are
never automatically replayed or given this artificial read timeout.
Customer/admin notices warn that saved results can be stale; an empty report
does not prove there are no orders. Auth service outages are not described as
incorrect passwords. These notices cannot bypass a provider quota or unpause a
project. A paid order must be checked before another payment attempt.

## Maintenance checklist

- Review database, uncached/cached egress, Storage, Edge calls and Realtime usage
  in Supabase weekly. Act before 70–80% of a Free allowance is used.
- Check project activity before a demonstration. Free projects can pause after
  prolonged low activity. Do not add artificial keep-alive traffic.
- Preserve MFA, RLS and ownership checks. Free does not include the paid leaked
  password checking service; do not claim that protection is enabled.
- Keep old mobile releases until their active-channel references and recovery
  needs are reviewed. Do not remove objects just to reduce quota usage.
- CI runs the release suite on pushes, PRs and weekly. Monthly Dependabot PRs
  propose npm minor/patch updates; major upgrades require separate validation.
  No dependency PR is automatically merged or deployed.
- Node 22 is pinned for local/CI/build use. The frontend lockfile and Edge Deno
  lockfile pin dependencies. Run `npm run verify:release` and `npm run test:browser`
  before deployment. Keep secrets scanning and security headers enabled.
- Free has no uptime guarantee from these changes. Real payments, email/SMS
  delivery, physical devices and a complete hosted recovery need separate proof.

Official references: [Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing),
[backup responsibilities](https://supabase.com/docs/guides/platform/backups),
[Edge limits](https://supabase.com/docs/guides/functions/limits),
[password security](https://supabase.com/docs/guides/auth/password-security).
