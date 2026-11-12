# Managed database maintenance — 12 November 2026

This record covers the shared hosted backend, not a new frontend or mobile
application release. Maintenance timing was approved by the project owner.

## Preflight

- Verified the existing production release and an encrypted local backup made
  today. Re-ran its isolated logical restore, relational-constraint validation,
  and support/return attachment-reference checks. This is not a full hosted
  disaster-recovery rehearsal or a point-in-time snapshot.
- No orders or payment changes in the preceding 30 minutes and no unexpired
  pending online checkouts were observed immediately before maintenance.
- Supabase reported an eligible same-major GA upgrade with no validation
  errors, warned dependencies, or objects to be dropped. The offered build
  advanced from 17.11.0.018 to 17.11.0.019 before submission; the final
  eligibility response was rechecked, not bypassed.
- Native administrative reads succeeded with certificate/hostname validation
  and TLS 1.3. Direct-database SSL enforcement was enabled and reported applied
  successfully before initiating the upgrade.
- Application stored routines contained no legacy PGP encryption call sites;
  ltree and btree_gist extensions were absent. Public indexes were valid.

## Changes and verification

The managed upgrade was accepted at 10:01:46 UTC (18:01 Manila) and completed
at 10:23:20 UTC (18:23 Manila), including the provider's post-physical-backup
stage. The tracked request reported status 1 and
`10_completed_post_physical_backup`; the project returned to ACTIVE_HEALTHY.
Current and latest available GA build both read `supabase-postgres-17.11.0.019`.
The unqualified upgrade-status endpoint resets to null after completion;
the tracking-specific endpoint preserves the completed result.

- Native certificate-verified connections report PostgreSQL 17.11 and TLS 1.3.
  SSL enforcement remained enabled after the database change.
- Counts match the preflight: 181 orders, 53 Auth accounts, 126 payment records,
  91 products, 548 Storage objects, 10 active jobs, 55 RLS-enabled public
  tables, and zero invalid public indexes.
- All 211 public/private application routine definitions and grants match
  the encrypted backup individually. A first aggregate hash ordered by
  internal object IDs differed; those IDs are not stable across upgrades.
  Public and Storage policy definitions also match the preflight.
- Guest read grants on orders, profiles and payments remain absent; admin MFA
  policy remains enabled. Private storage buckets and limits are unchanged.
- A read-only public product Realtime subscription was acknowledged; no
  test product or database event was written.
- Public catalog and Auth settings HTTP checks passed. Hosted Chromium checks
  rendered catalog and customer login at 390px and admin login at 1440px with
  no page errors or horizontal overflow. Nineteen route shell/security-header
  checks passed. These are not authenticated checkout or payment proofs.
- Scheduled jobs resumed: 62 successful runs and zero failed runs were counted
  after services returned at the time of the initial post-upgrade check.
- After provider completion, Management API database reads recovered and the
  Auth, database, connection pooler, Realtime, REST and Storage health checks
  all returned healthy. The website remains on tested application commit
  `ffe28021c607b20b464e10fd87c9c3845559f0b5`; no frontend redeploy is needed for
  this managed backend change. The provider's upgrade backup does not create
  a Free-plan promise of daily backups or point-in-time recovery.

## Boundaries

No customer account was suspended, MFA factor enrolled, password reset,
production order created, or payment charged. No application grants were
broadly revoked and no stored customer files were deleted. Administrative IP
allowlisting still requires known recovery routes. Staff and hosting-provider
MFA enrollment remains an account-owner responsibility.

References:

- https://supabase.com/docs/guides/platform/upgrading
- https://supabase.com/docs/guides/platform/ssl-enforcement
