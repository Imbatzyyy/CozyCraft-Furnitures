# Project demonstration guide

This sequence presents CozyCraft as one connected system without exposing
credentials or spending the demonstration on setup screens.

## Before the presentation

- Run `npm run verify` and `npm run smoke:prod`.
- Confirm the demonstration customer and admin accounts work, but keep their
  passwords outside slides, source code, and the repository.
- Prepare one active in-stock product, one low-stock product, one delivered
  order eligible for review, and one open support ticket.
- Confirm PayMongo is in the test environment and no real payment can occur.
- Open customer and admin experiences in separate browser profiles.
- Clear unrelated notifications and close personal browser tabs.

## Suggested ten-minute flow

1. Introduce the problem, target users, and system architecture.
2. Browse by room, search the catalog, filter a price range, and open a product.
3. Add the product to the wishlist and cart; show cross-page totals and stock
   limits.
4. Complete a cash-on-delivery or PayMongo test checkout.
5. Open the admin order desk and show the new order arriving without a full-page
   reload.
6. Update fulfillment status and show the customer order timeline update.
7. Show a delivered-product review with optional photos, then moderate it in the
   admin workspace and display it on the product page.
8. Show customer support status and the notification center.
9. Explain role access, RLS, Edge Functions, and why provider secrets are not in
   the browser.
10. Close with test evidence, deployment architecture, and planned improvements.

## Presentation safeguards

- Never open `.env.local`, Supabase secrets, provider dashboards, or raw auth
  records while screen sharing.
- Use anonymized demonstration data instead of real customer personal data.
- Do not paste secret keys into chat, slides, source files, or screenshots.
- If a provider is temporarily unavailable, use the prepared architecture and
  test evidence to explain the completed integration rather than changing live
  configuration during the presentation.
