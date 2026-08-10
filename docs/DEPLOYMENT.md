# Deployment guide

CozyCraft has three release surfaces: the Supabase backend, the Netlify web
application, and Cloudflare DNS. Deploy backend dependencies before a frontend
release that calls them.

## Environments and secrets

### Browser variables

Netlify and local `.env.local` use only:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Both values are browser-visible by design. RLS, grants, and authenticated server
functions provide the security boundary.

### Server-only secrets

Provider and privileged values belong in Supabase Edge Function secrets. These
include the Supabase service-role key, PayMongo keys, webhook secrets, Resend
API key, and assistant-provider key. Never prefix them with `VITE_`, commit them,
or paste them into frontend settings.

## Release order

1. Review the diff and confirm no secrets, local state, or unrelated migrations
   are staged.
2. Run the local release gate.

   ```bash
   npm ci
   npm run verify
   ```

3. If the release includes migrations, link the Supabase CLI to the intended
   project and deploy only the reviewed migration set.
4. If the release includes Edge Functions, deploy the changed functions and
   confirm all required server secrets exist.
5. Push the reviewed web commit. Netlify uses `netlify.toml` to run
   `npm run verify` and publish `dist`.
6. Wait for Netlify to report a successful production deploy.
7. Run the production smoke test.

   ```bash
   npm run smoke:prod
   ```

8. Manually verify sign-in boundaries, catalog loading, cart persistence,
   checkout, admin authorization, and any changed workflow.

## Netlify behavior

- The build output is `dist`.
- All client routes rewrite to `index.html` for React Router.
- The application shell is not cached, preventing it from pointing to removed
  hashed chunks after a release.
- Content-hashed assets are cached as immutable.
- Security and no-index headers are defined in `netlify.toml`.

## Cloudflare behavior

Cloudflare owns the production domain, DNS, and mail-related records. DNS-only
records used by Resend must remain configured as required by that provider.
Changing nameservers, proxy status, or mail records is an infrastructure change
and must be documented and verified separately from a web release.

## Rollback

- Web application: redeploy the last known-good Netlify deploy or revert the
  faulty commit and push the new revert commit.
- Edge Function: redeploy the last known-good function source.
- Database: use a new forward migration to restore compatibility. Do not delete
  or rewrite migration history that has already been applied.
- Secrets: rotate the value at the provider and Supabase immediately if exposure
  is suspected, then redeploy affected functions.

## Post-release evidence

Record the commit, Netlify deploy result, migration and function list, smoke-test
result, and any manual scenarios checked. Do not include credentials, customer
personal data, full payment references, or private screenshots in release notes.
