# Website Profile and Home Circle

Scope: only the customer Profile content, a new Home Circle sidebar entry and
its page. Existing Orders, Addresses, Payments, Security and Support content and
handlers are unchanged. The mobile application's source was inspected read-only.

Open `/profile?tab=home-circle` after signing in. The page uses the same
`mobile_loyalty_accounts`, `mobile_loyalty_transactions` and
`mobile_loyalty_redemptions` records as the app, through the normal customer
Supabase client. No service-role credentials or new public database policies.
The existing authenticated `get_mobile_loyalty` RPC is used only if an account
row is missing. Existing accounts are read without recalculation writes.

## Data and performance

- No Home Circle network requests until its tab is opened.
- Three selective reads for an existing membership: balance, latest 20 activity
  entries, and six available/unexpired rewards plus one pagination sentinel. All filter by current user.
- A component-owned 60-second cache survives tab switches; it is discarded when
  the authenticated profile unmounts. No account data added to local storage.
- A Refresh button explicitly reloads. No polling, focus reload or realtime
  subscription is added. Voucher expiry checks run locally only, without database reads.
- Fetches abort after 12 seconds and when leaving the tab. Errors offer refresh
  and retain an already-loaded snapshot rather than inventing zero balances.
- Activity pagination is five entries per page within the latest 20 records.

## Voucher exchange and checkout

The website shares the app's wallet and supports 100 points for PHP 100,
250 points for PHP 300, and 500 points for PHP 700. A confirmation dialog precedes
every exchange. Server-side idempotency prevents a retry from spending twice.
New vouchers expire after 30 days; the UI uses the actual database expiry.
Available rewards use six cards per page. Expired or ineligible rewards cannot
be selected. Checkout supports one voucher for COD, card or GCash, with minimum
spend and eligibility checked again in the database. Order creation and voucher
application are atomic. Provider amounts use the persisted discounted total.
Attaching a new voucher after payment initialization or fulfillment is rejected.

## Claim email

New points exchanges queue an immutable email snapshot in a server-only outbox,
including exchanges from the mobile app. No historical claims are emailed.
The worker uses a stable provider idempotency key and guarded leases, with at
most six attempts within 23 hours. An indexed cron check makes an outbound
request only when a job is due. The branded HTML and plain-text email contain
the actual value, minimum spend, points cost and Philippine-time expiry.
Only the public email logo permits cross-origin embedding. Claim success means
the email is queued, not a guarantee of inbox delivery.

## Verification

Unit tests cover tier progress presentation, absent data, expired vouchers,
activity limits, profile fallbacks, user-scoped queries and missing-account
initialization. Browser component fixtures were checked at 320/375/390/768/1280
pixels without horizontal overflow; activity pagination was clicked. A network
fixture confirmed zero inactive reads, three initial reads, and cache reuse on
immediate tab re-entry. These fixtures do not replace authenticated real-device
end-to-end testing of a customer's account.
