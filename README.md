# CozyCraft Furnitures

CozyCraft is a full-stack furniture commerce platform built for customers and
store operations teams. The storefront supports catalog discovery, account
management, carts, wishlists, checkout, order tracking, reviews, returns, and
customer care. A separate role-protected administration workspace manages the
catalog, inventory, orders, payments, customers, member tiers, reviews, support, reports,
team access, activity logs, and store settings.

Production: [www.cozycraftfurnitures.com](https://www.cozycraftfurnitures.com)

## Key capabilities

- Responsive customer storefront for desktop, tablet, and mobile browsers.
- Email/password and Google authentication through Supabase Auth.
- Role-separated customer, staff, administrator, and super administrator
  access.
- Database-backed cart and wishlist state with realtime synchronization.
- Cash on delivery and PayMongo test checkout flows.
- Realtime order fulfillment, notifications, support tickets, and reviews.
- Product catalog management with inventory, specifications, images, and
  category placement.
- Secure server-side workflows through Supabase Edge Functions.
- Email delivery through Resend and a website-aware customer care assistant.

## Technology stack

| Layer | Technology |
| --- | --- |
| Web application | React 18, TypeScript, Vite, React Router |
| Styling and UI | Tailwind CSS, Radix UI, Material UI, Lucide icons |
| Backend | Supabase Postgres, Auth, Storage, Realtime, RPC, Edge Functions |
| Payments | PayMongo test environment |
| Transactional email | Resend through server-side functions and Supabase Auth SMTP |
| Hosting | Netlify, with Cloudflare DNS and domain management |
| Quality checks | TypeScript, Vitest, production build, smoke test |

## Repository structure

```text
.
├── docs/                       Project, architecture, database, and operations documentation
├── public/                     Static browser assets and application icons
├── scripts/                    Repeatable project utility and production smoke scripts
├── src/
│   ├── app/                    Application startup, routes, contexts, and feature modules
│   │   ├── core/               Shared domain types, state, layouts, and cross-feature helpers
│   │   └── features/
│   │       ├── admin/          Protected administration workspace
│   │       └── storefront/     Customer-facing shopping and account experiences
│   ├── assets/                 Source-controlled brand and content assets
│   ├── components/             Reusable media and UI building blocks
│   ├── lib/                    Pure domain logic grouped by business area
│   ├── services/               Supabase and authentication integration boundaries
│   └── styles/                 Global styles, design tokens, fonts, and Tailwind entry points
└── supabase/
    ├── email-templates/        Branded authentication email templates
    ├── functions/              Privileged server-side and provider integration workflows
    └── migrations/             Versioned database schema, RPC, RLS, and security changes
```

See [Architecture](docs/ARCHITECTURE.md) for the module boundaries and runtime
data flow.

## Local development

Requirements:

- Node.js 20 or newer
- npm 10 or newer
- Access to a configured Supabase project for authenticated and database-backed
  features

1. Install the locked dependencies.

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and enter the browser-safe Supabase URL
   and publishable key. Never place service-role or provider secret keys in a
   `VITE_` variable.

3. Start the development server.

   ```bash
   npm run dev
   ```

4. Open the local URL printed by Vite.

## Verification commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm test` | Run the Vitest suite once |
| `npm run build` | Create the optimized `dist` build |
| `npm run verify` | Run type checking, tests, and the production build |
| `npm run smoke:prod` | Verify important production routes and security headers |
| `npm run audit:prod` | Review high-severity production dependency advisories |

The required release gate is `npm run verify`. Additional test guidance is in
[Testing](docs/TESTING.md).

## Deployment

Netlify runs `npm run verify` and publishes `dist`. Supabase migrations and Edge
Functions are deployed separately because they are backend changes. Cloudflare
manages the production domain and DNS records.

Follow [Deployment](docs/DEPLOYMENT.md) for the release checklist, secrets,
database order, validation, and rollback procedure.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [API and integration boundaries](docs/API_INTEGRATIONS.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Demonstration guide](docs/DEMO_GUIDE.md)
- [Team contribution record](docs/TEAM_CONTRIBUTIONS.md)
- [Security notes](SECURITY.md)
- [Third-party notices](docs/legal/THIRD_PARTY_NOTICES.md)

## Security

Only the Supabase project URL and publishable key are allowed in the browser.
All privileged keys belong in Supabase Edge Function secrets. Authorization is
enforced by database grants, row-level security, protected RPC functions, and
server-side role checks. Read [SECURITY.md](SECURITY.md) before changing auth,
payments, customer data, storage, or administrative permissions.
