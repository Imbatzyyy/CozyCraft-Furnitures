# Reliability hardening — 6 September 2026

## Changes

- Product content saves omit inventory and compare the original `updated_at`.
  Older drafts without a version are preserved but must be reopened before saving.
  Existing product stock is adjusted from Inventory, not the content form.
- Cancellation dialogs are tied to the captured order and close on changes.
- Shared admin refreshes finish in-flight work and coalesce one follow-up, with
  a two-second maximum debounce. They never reload the document.
- Customer directory: ten records per page, server-side search and aggregates,
  signed avatar URLs, primary delivery address only. Overview no longer loads
  the customer history graph. Reports request profile columns without histories.
- Product loading errors have a bounded timeout and explicit retry.
- SMS reservation and OTP consumption are atomic, service-role-only operations.
  Invalid attempts, number uniqueness, profile update, and audit entry are protected.
- Chatbot budgets are shared across instances: 45 authenticated / 30 guest
  requests per minute, plus a conservative **2,000 requests per UTC day overall**.
  This counts admitted requests, not just paid completions. A blocked request
  does not call the AI provider. Budget failures fail closed. Stored guest keys
  are hashed; no chat contents are stored in the quota table. Expired quota rows
  are cleaned in bounded batches. Adjust the daily ceiling deliberately after
  reviewing actual use; an external provider spending limit is still advisable.

## Release order — approved by the user on 6 September 2026

1. Apply `20260906020220_harden_concurrent_operations.sql` first. Existing
   functionality is retained; the new functions are additive.
2. Deploy `verify-customer-phone` and `cozycraft-assistant`. They require the
   new RPCs and the existing server-only service-role environment variable.
   Never copy service credentials into frontend variables.
3. Build/publish the frontend from the same revision.
4. Verify actual authenticated admin/customer flows, provider SMS delivery,
   and new function permissions. Inspect database advisors after release.
5. Separately enable Supabase leaked-password protection if the account plan
   supports it. No live authentication configuration was changed in this work.

The existing privileged-function advisor warnings are not automatically
vulnerabilities. This revision restricts its new OTP/quota functions to
`service_role`; it does not indiscriminately revoke existing application RPCs.

Database migration and both Edge Functions were released on 6 September.
A read-only authenticated-role query verified ten customer records per page
against the deployed schema. New OTP/quota RPC grants are service-role-only.
Advisor counts remained unchanged: 28 existing privileged-function warnings
and leaked-password protection disabled. That external setting remains open.

## Verification

- `npm run verify`: TypeScript, Vitest, production build.
- `scripts/test-admin-login.mjs`: simulated APIs; MFA/non-MFA, mobile/desktop,
  stable queue, cancellation target invalidation, stale product write protection.
- `scripts/test-storefront-quality.mjs`: responsive customer page regression.
- `scripts/test-product-recovery.mjs`: failed requests followed by successful retry.
- `scripts/test-concurrency-hardening.mjs`: isolated PostgreSQL fixture; concurrent
  SMS reservation, attempt lockout, phone uniqueness, shared quotas, function
  grants, directory pagination. Requires disposable `cozy-hardening-test-db`.
- Deno check both changed Edge Functions using `--no-config --no-lock
  --node-modules-dir=none` when the workspace uses Node dependencies.

Browser scripts accept `PLAYWRIGHT_MODULE` and `TEST_BASE_URL`. They stub
external APIs and do not charge, send messages, or prove real-provider delivery.
The isolated database tests do not substitute for a post-release RLS/session
smoke test against the full deployed schema.
