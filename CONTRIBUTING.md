# Contributing to CozyCraft

## Working agreement

- Keep customer and administrator experiences behaviorally separate even though
  they use the same backend.
- Preserve existing user data and migrations. Never edit migration history that
  has already been deployed.
- Do not commit credentials, personal customer data, local environment files,
  Netlify state, Supabase temporary state, or uncompressed scratch exports.
- Keep unrelated changes out of a feature commit.
- Run the release gate before requesting review.

## Where code belongs

- Customer pages: `src/app/features/storefront/<area>`.
- Admin pages: `src/app/features/admin/<area>`.
- Shared visual primitives: `src/components`.
- Pure reusable business logic: `src/lib/<domain>` with a colocated test.
- Provider and authentication clients: `src/services`.
- Database, RLS, RPC, and storage changes: a new file in
  `supabase/migrations`.
- Privileged or secret-bearing workflows: `supabase/functions/<function>`.
- Long-term project knowledge: `docs`.

## Change workflow

1. Pull the current branch and review existing uncommitted work.
2. Create a focused branch or commit for one feature or repair.
3. Implement the smallest complete change, including authorization and error
   behavior.
4. Add a test for pure logic or a documented manual scenario for integrated UI.
5. Run:

   ```bash
   npm run verify
   ```

6. Review `git diff` and `git status` before committing.
7. Use a short imperative commit message, such as `Fix realtime order refresh`.

## Review checklist

- The user-facing requirement is satisfied on desktop and mobile.
- Loading, empty, error, success, and retry states are intentional.
- Authorization is enforced in the database or server function, not only the UI.
- Customer-owned queries are scoped and do not download unrelated records.
- Realtime subscriptions are cleaned up and do not duplicate listeners.
- No secret, personal data, debug output, or unused asset was added.
- Tests, type checking, and production build pass.
- Documentation is updated when architecture, schema, configuration, or release
  behavior changes.
