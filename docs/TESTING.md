# Testing strategy

CozyCraft combines automated checks with role-based and provider-specific manual
testing. A successful build alone does not verify database authorization,
realtime behavior, or hosted payment redirects.

## Automated release gate

```bash
npm run verify
```

This command runs:

1. `npm run typecheck` for TypeScript correctness.
2. `npm test` for Vitest domain and regression tests.
3. `npm run build` for the optimized Vite production bundle.

After production deployment, run:

```bash
npm run smoke:prod
```

The smoke script checks important public routes, SPA behavior, and expected
production headers without mutating customer data.

## Unit-test ownership

Pure rules are kept in `src/lib` and tested beside their implementation:

- Admin access and dashboard metrics.
- Catalog discovery, new arrivals, price ranges, product identity, images, and
  specifications.
- Checkout totals, order state transitions, realtime event handling, and return
  workflow rules.
- Store setting parsing and safe function errors.
- Authentication helpers and PayMongo session mapping.

Add a regression test whenever a bug can be represented as deterministic input
and output.

## Manual role matrix

| Scenario | Visitor | Customer | Staff | Administrator | Super administrator |
| --- | ---: | ---: | ---: | ---: | ---: |
| Browse active catalog | Yes | Yes | Yes | Yes | Yes |
| Use cart, wishlist, and checkout | Sign-in required | Yes | Customer account only | Customer account only | Customer account only |
| View own profile and orders | No | Own data | No | No | No |
| Manage catalog and fulfillment | No | No | Assigned tools | Yes | Yes |
| Manage customers, payments, reports | No | No | Restricted | Yes | Yes |
| Manage team roles and store security | No | No | No | Restricted | Yes |

Test customer and admin sessions in separate browser profiles. Confirm that an
admin session does not become a storefront customer session and that customer
credentials cannot enter the admin workspace.

## Critical manual flows

Before a significant release, verify:

- Registration, duplicate-email handling, confirmation, sign-in errors, Google
  OAuth, recovery, and password-provider behavior.
- Product discovery by room and subcategory, search, price range, stock limits,
  new arrivals, recently viewed items, and main-image changes.
- Cart and wishlist persistence after refresh, sign-out, and a second device.
- Cash on delivery and PayMongo test checkout, payment return, session retention,
  webhook settlement, and duplicate-click protection.
- Order status timestamps, realtime customer/admin updates, cancellation,
  refunds, and refund-email resend behavior.
- Delivered-product review eligibility, two-image limit, moderation, and product
  page display.
- Support replies and statuses, notification center, settings propagation, and
  activity logging.
- Mobile navigation, dialogs, fixed controls, on-screen keyboard behavior, and
  320 px viewport layouts.

## Database security checks

For RLS or RPC changes, test expected success and expected denial as:

- Anonymous visitor.
- Authenticated customer owning the row.
- Authenticated customer who does not own the row.
- Staff member with limited permissions.
- Administrator and super administrator.
- Service role only for operations explicitly designed for it.

Never run destructive security tests against production customer records.
