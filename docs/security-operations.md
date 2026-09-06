# Security operations and release checks

## Implemented boundaries

- Database staff helpers require an active Auth session, active account, configured MFA, and server-side idle validity.
- Own profile reads are available during MFA enrollment; updates require full verification.
- Privileged user-facing Edge Functions use the caller's JWT for a database authorization check before service-role access. Resource ownership checks remain mandatory inside handlers.
- Device management rejects revoked sessions. The browser idle timer is backed by a server activity record updated at most once per minute during interaction.
- Newsletter budgets: 200 requests per day globally, 10 per source per hour, one destination reservation per two minutes. Destination/source identifiers are keyed hashes, not stored addresses/IPs.
- Transactional sends: one entity/event reservation per two minutes, 30 per actor per hour, 1,000 globally per day. Staff resend does not bypass these limits.
- Review media is private. Published reviews receive visibility-checked URLs with a 60-second signed redirect. Previously issued links and already downloaded copies cannot be recalled instantly. Admin preview links last five minutes.
- Stored review URLs are rewritten for older clients. Physical iOS/Android validation remains required after a shared-backend release.
- Customer storage policies cap uploads at 20 objects per bucket per day and 200 total objects per account across customer buckets. Review uploads require a delivered order item and at most three objects per item. Existing bucket size and MIME restrictions remain.

## Explicit remaining work / owner decisions

- `security-workflow.yml` is a ready-to-activate workflow template. The connected GitHub OAuth credential lacks workflow permission, so CI installation is not represented as active.

- Supabase Free does not provide the available paid leaked-password protection toggle. Upgrade approval and activation must be completed by the owner; no purchase is automated.
- Configure a real CAPTCHA provider before enabling CAPTCHA on production authentication or newsletter endpoints. Both client token handling and server verification must ship together; enabling only the dashboard switch breaks legitimate login. Current shared limits are not a CAPTCHA substitute.
- Set MFA and least-privilege membership on GitHub, Supabase, Netlify, email, SMS, payment, and AI provider accounts. Do not collect recovery codes in this repository.
- Establish backups and a restore drill in a separate project. Record recovery time and validate order totals, ownership policies, and authentication. Never test restoration over production. Storage objects require their own backup strategy.
- Configure provider spending alerts and incident recipients through owner accounts. Application quotas do not cap every provider or every possible API path.
- Add parent-record upload reservations for support/return attachments, server-side file-signature checking, and reviewed orphan cleanup. Current compatibility-preserving quotas do not claim these features.
- An active mobile admin client must report server activity or reauthenticate after expiry; do not promise old app builds have the website's new heartbeat behavior.

## Release verification

1. Run `npm run verify`, `npm run audit:prod`, and `git diff --check`.
2. Run `scripts/test-security-boundaries.mjs` against the named disposable database container. It must never use the linked production database.
3. Run the Deno boundary tests and type checks on changed functions.
4. Rehearse migrations in a transaction and roll back. Do not print private customer rows or tokens.
5. Deploy the review-photo endpoint before rewriting stored URLs; apply migrations, then publish the matching web build and privileged functions.
6. Verify live AAL1 denial, AAL2 authorization, revoked-session denial, hidden photo denial, published photo loading, and production route smoke checks.
7. With controlled test accounts, check customer A cannot read customer B's data; test fresh admin login/MFA, device revocation, checkout, and review upload on desktop/iOS/Android. Automated policy tests do not replace these end-to-end checks.

## Incident response

1. Preserve relevant audit records; never log passwords, OTPs, bearer tokens, or full payment data.
2. Disable the affected account or endpoint and revoke affected sessions through supported controls.
3. Rotate only the affected provider credentials, update server secrets, and verify service recovery. Do not place credentials in frontend environment variables or commits.
4. Investigate the affected records and time window. Do not infer a breach merely from a failed request.
5. Restore only to an isolated environment first; obtain explicit approval for production restoration or destructive cleanup.
6. Document the root cause and add a regression test before reopening access.
