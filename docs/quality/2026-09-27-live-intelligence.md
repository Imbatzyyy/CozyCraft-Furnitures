# Live-only CozyCraft Intelligence

This supersedes the September 22 forecast/demo behavior. The admin Reports panel
and production worker now use only authenticated settlement aggregates. Synthetic
fixtures exist only under `src/test` and in the localhost QA harness. No customer
chatbot, mobile-app, order, payment or profile records are changed by this release.

## Data and algorithm

The migration `20260927090000_live_forecast_inputs.sql` retains staff/MFA gates,
bounds responses to 180 complete Philippine days and adds coverage diagnostics.
It excludes provider test payments, unpaid/cancelled/refunded orders, missing
timestamps, invalid amounts, today and future settlements. Paid delivered COD uses
recorded delivery time; online settlements require a live-mode paid transaction.
Each order is counted once. Unmarked demonstration COD cannot be inferred from its
data: administrators must maintain accurate source records.

Recent/historical averages and two Teunter–Syntetos–Babai (TSB) smoothing rates
compete on horizon-matched rolling-origin RMSE. TSB learns daily settlement
occurrence and positive settlement size separately. Sufficient active history
also enables weekly and ridge-regression candidates. A separate final holdout
reports error and never chooses a replacement winner. The winner is refitted on
all complete history. Source days, MAE/RMSE, candidates and algorithm version are
visible; CSV includes the source snapshot, evidence classification and version.

Initial estimates require 28 complete days / 3 active days (7-day horizon), or
42 / 4 (14-day horizon), plus earlier activity for validation. These are application
minimums, not statistical guarantees. Sparse history, quiet holdouts, few validation
windows and little recent activity mean **limited evidence**. High-error dense
forecasts are withheld. Empirical error guides are not calibrated probability
intervals. Tiny positive order estimates show `<0.01`, with precision retained in CSV.

Observed September 27: 59 complete days, 8 eligible orders, 7 active days, 76 test
payments excluded, no eligible undated settlements. Last eligible settlement:
September 1. Both horizons selected TSB (0.3), explicitly preliminary. Initial
7-day sales estimate: PHP 8.43, with a much wider error guide. This low estimate
reflects a quiet period, not proof future sales will be near zero. Current-status
reconciliation is retrospective, not archived as-of backtesting. Test purchases
were not relabelled as real revenue.

Method references: [rolling-origin validation](https://otexts.com/fpp3/tscv.html),
[intermittent-count forecasting limitations](https://otexts.com/fpp3/counts.html),
[Teunter, Syntetos and Babai (2011)](https://research.rug.nl/en/publications/intermittent-demand-linking-forecasting-to-inventory-obsolescence).

## Efficiency and lifecycle

- Measured live JSON summary: approximately 3.24 KB, no customer identity graph.
- Private 15-minute cache, invalidated transactionally by relevant order, payment
  and delivery-history writes. A shared advisory lock coordinates invalidation
  and rebuilding so concurrent writes cannot leave a pre-change cached result.
- Fresh verified admin entry loads automatically. Manual refresh, reconnect and
  visible recovery after 15 minutes recheck; no periodic polling or new subscription.
- Background worker with bounded fallback, identity-safe response handling and
  distinct loading, invalid-response, calculation-error and stale-snapshot states.
- No external AI provider, transferred customer data or new AI API costs.

## Verification

- `npm run verify`: TypeScript, complete regression suite and production build.
- `FORECAST_QA_CONTAINER=cozy-architecture-qa node scripts/test-intelligence-db.mjs`:
  disposable local PostgreSQL tests for exclusions, invalid amounts, cache
  invalidation, role/MFA gates, cache reuse, report exports and empty history.
- `node scripts/release-live-forecast.mjs`: migration rehearsal and 10 live-schema
  role/aggregate assertions, all rolled back. `--apply` applies only the named
  migration and records it. `--installed` repeats assertions after application.
  Temporary QA auth sessions always roll back; no live customer records are edited.
- `--snapshot /tmp/cozy-forecast-live.json` exports bounded QA aggregates only;
  `FORECAST_PREVIEW_SNAPSHOT=/tmp/cozy-forecast-live.json node scripts/preview-intelligence.mjs`
  renders that exact snapshot locally. This is not a production route or proof of
  a full authenticated administrator browser journey.

Responsive browser checks and isolated tests do not certify every physical device
or guarantee future forecasting accuracy. The existing lazy HEIC bundle warning
is unrelated to these changes.
