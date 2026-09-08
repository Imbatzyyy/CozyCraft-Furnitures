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
  entries, and up to 20 available/unexpired rewards. All filter by current user.
- A component-owned 60-second cache survives tab switches; it is discarded when
  the authenticated profile unmounts. No account data added to local storage.
- A Refresh button explicitly reloads. No polling, focus reload or realtime
  subscription is added. Expiry display checks every 30 seconds locally only.
- Fetches abort after 12 seconds and when leaving the tab. Errors offer refresh
  and retain an already-loaded snapshot rather than inventing zero balances.
- Activity pagination is five entries per page within the latest 20 records.

The website currently **displays** the shared reward wallet. Exchanging points
and applying a reward remain in the app, as stated in the UI. This revision does
not change website checkout or claim that web reward redemption is implemented.

## Verification

Unit tests cover tier progress presentation, absent data, expired vouchers,
activity limits, profile fallbacks, user-scoped queries and missing-account
initialization. Browser component fixtures were checked at 320/375/390/768/1280
pixels without horizontal overflow; activity pagination was clicked. A network
fixture confirmed zero inactive reads, three initial reads, and cache reuse on
immediate tab re-entry. These fixtures do not replace authenticated real-device
end-to-end testing of a customer's account.
