# API and integration boundaries

CozyCraft does not contain a traditional standalone application server. Browser
modules communicate with Supabase's authenticated APIs, while operations that
require secrets or elevated permissions run in Supabase Edge Functions.

## Browser-safe integrations

| Integration | Purpose | Browser credential |
| --- | --- | --- |
| Supabase Auth | Customer and administrator sessions, OAuth, password recovery, MFA | Project URL and publishable key |
| Supabase Data API and RPC | RLS-protected catalog, profile, commerce, and operations data | User JWT through the Supabase client |
| Supabase Realtime | Cross-device catalog, cart, wishlist, order, support, notification, and settings updates | User JWT and RLS |
| Supabase Storage | Catalog images and authorized private customer uploads | User JWT or public catalog URL |
| Philippine address data | Region, province, city, municipality, and barangay selection | Public package or protected lookup endpoint |

The Supabase publishable key is designed for browser use and does not bypass
RLS. It must never be replaced by a secret or service-role key.

## Edge Functions

| Function | Responsibility |
| --- | --- |
| `manage-team-member` | Invite and manage approved staff accounts with role checks |
| `create-paymongo-checkout` | Validate an order and create a PayMongo checkout session |
| `cancel-paymongo-checkout` | Cancel eligible unpaid provider sessions |
| `paymongo-webhook` | Verify provider events and settle payments atomically |
| `sync-paymongo-payments` | Reconcile payment state when a webhook or return is delayed |
| `cancel-order` | Apply the protected order cancellation workflow |
| `process-return-refund` | Validate an approved return and process the refund workflow |
| `send-refund-email` | Send or resend a customer refund notice |
| `cozycraft-assistant` | Answer customer questions using approved store and catalog context |
| `philippine-barangays` | Return location options used by delivery address forms |
| `mobile-payment-return` | Handle the mobile application payment return boundary |

## External providers

- PayMongo test APIs provide hosted GCash and card checkout for demonstration.
  The secret key and webhook secret remain in Edge Function secrets.
- Resend sends transactional and refund messages from the verified CozyCraft
  mail domain. Its API key remains server-side.
- Google OAuth is configured through Supabase Auth and Google Cloud. The OAuth
  client secret is stored in provider configuration, not the web bundle.
- The customer care assistant calls its configured model provider from an Edge
  Function. Provider credentials and internal instructions are never sent to
  the browser.

## Error and retry contract

- The browser displays a customer-friendly message and logs safe diagnostic
  context without secrets or personal data.
- Payment, checkout, webhook, and refund operations use idempotency or database
  transaction boundaries so a retry does not create duplicate financial state.
- Realtime is an acceleration layer, not the only source of truth. Pages perform
  an initial database read and refresh after reconnecting.
- Edge Function responses return only the fields needed by the caller.

## Adding an integration

1. Decide whether it can safely run with browser-visible credentials. When in
   doubt, use an Edge Function.
2. Put secret values in Supabase secrets and document only their variable names.
3. Add input validation, authorization, timeouts, safe errors, and idempotency.
4. Add or update database policies before exposing new data.
5. Add unit tests for pure mapping logic and a manual provider test plan.
6. Update this document and the deployment checklist.
