# CozyCraft application architecture

## Module boundaries

- `src/app/App.tsx` owns application startup, session-backed store state, realtime
  subscriptions, and route registration.
- `src/app/core/index.tsx` contains shared domain models, contexts, layout
  components, formatting helpers, and reusable UI primitives.
- `src/app/features/storefront/catalog.tsx` contains the home, about, collection,
  and product-detail experiences.
- `src/app/features/storefront/commerce.tsx` contains cart, wishlist, checkout,
  and customer order experiences.
- `src/app/features/storefront/auth.tsx` contains customer authentication and
  password recovery.
- `src/app/features/storefront/profile.tsx` contains account and address
  management.
- `src/app/features/admin/shell.tsx` contains administrator authentication and
  the protected operations shell.
- `src/app/features/admin/catalog.tsx` contains product, category, and inventory
  management.
- `src/app/features/admin/operations.tsx` contains order, customer, support,
  review, report, payment, and activity views.
- `src/app/features/admin/team-settings.tsx` contains team access and store
  settings.
- `src/lib/supabase.ts` is the shared backend client and database model boundary.
- `supabase/functions/manage-team-member` is the privileged server-side team
  management boundary.
- `supabase/migrations` is the versioned database schema and security boundary.

## Communication

Storefront and administration modules share authenticated application state
through `StoreContext`. Persistent communication uses Supabase Auth, Data API,
RPC, Storage, Realtime, and Edge Functions. Privileged credentials remain in
the Edge Function and are not exposed to browser modules.

## Loading strategy

Routes dynamically import their feature module. Customers therefore do not
download the administration workspace when opening the storefront, and admin
users only download the operational module required by the current route.

## Deployment

Vite produces the static `dist` output. Netlify publishes that output and
rewrites client-side routes to `index.html`; Cloudflare provides the production
domain and DNS.
