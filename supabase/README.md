# Supabase backend

This directory contains the versioned backend used by the CozyCraft storefront,
administration workspace, and mobile application.

## Contents

- `migrations`: ordered Postgres schema, data repair, RPC, grants, RLS, storage,
  indexes, audit, and realtime changes.
- `functions`: Deno Edge Functions for privileged workflows and external
  providers.
- `functions/_shared`: server-only helpers shared by Edge Functions.
- `email-templates`: branded Supabase Auth email templates.
- `config.toml`: local Supabase configuration.

## Safety rules

- Never commit `supabase/.temp` or provider credentials.
- Never expose the service-role key to the browser or mobile client.
- Add a new migration instead of changing one already applied to the shared
  project.
- Deploy migrations before functions or clients that rely on the new schema.
- Keep Edge Function responses free of secrets and unnecessary customer data.
- Test RLS and role permissions whenever a table, RPC, or storage rule changes.

The broader data model is documented in `docs/DATABASE_DESIGN.md`; operational
security guidance is in `SECURITY.md`.
