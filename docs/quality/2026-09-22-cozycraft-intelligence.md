# CozyCraft Intelligence release — 22 September 2026

## Scope

- Admin Reports: 7/14-day settled-sales and settled-order forecasts, transparent validation, chart/table/CSV, and explicit synthetic demonstration.
- Customer: `/find-my-furniture`, a responsive guided shortlist with firm budget, product type, stock and measurement constraints.
- Existing customer-care chatbot, mobile application and payment workflows are unchanged.

## Models and interpretation

Forecasting is a small TypeScript implementation of regularized linear regression (ridge), competing against weekly and recent-average baselines. Features use previous days, weekly lags, trailing averages and day-of-week terms. Model selection uses chronological validation; the final holdout is not used to select a model. The final selected model is fitted to the available complete history. A simple baseline may win legitimately. Error bands are empirical historical-error guides, not calibrated probability intervals. This is retained settlement forecasting, not profit or unconstrained product demand.

Readiness requires at least 56 complete days for a seven-day horizon, or 84 for fourteen days, plus 14 active days and activity on four of the last 28 days. An unreliable final holdout also withholds a forecast. The synthetic demonstration is labelled on the screen, table and export and does not create orders.

Furniture matching learns term importance from the current public catalog using TF-IDF and ranks with cosine similarity. It is content-based machine learning, not generative AI, image recognition or an external model API. Hard constraints are applied separately from ranking. Unsupported measurements are excluded when a size limit is requested. Imported metric values with parenthesized imperial equivalents are handled; ambiguous ranges and seat widths are not mistaken for overall fit. Style and material preferences influence rank rather than silently overriding budget/size. No customer preference history is stored.

Primary references: [ridge regression](https://scikit-learn.org/stable/modules/linear_model.html#ridge-regression-and-classification), [TF-IDF](https://scikit-learn.org/stable/modules/feature_extraction.html#tfidf-term-weighting), [time-series validation](https://otexts.com/fpp3/tscv.html). These describe the methods; the implementation does not import scikit-learn or claim pretrained semantic understanding.

## Data, privacy and egress

- Forecast input: at most 180 complete Philippine-calendar days, daily totals only. Excludes provider test mode, unpaid/cancelled/refunded orders and missing settlement dates. Online payments use paid time; delivered paid COD uses its recorded delivery time. Today and future settlements are excluded.
- Authorisation is checked before cache hits. The private aggregate cache is not directly readable by customers or authenticated clients. Staff session/MFA checks and existing RLS apply to report reads/exports.
- Fifteen-minute server cache, no forecast polling, background worker calculation with bounded fallback. The measured live aggregate response was 3,115 bytes (JSON text) at release validation.
- Reports no longer fetch complete customer/order graphs on mount. They use aggregate reads and fetch bounded 250-row pages only for an explicit export. Exports have timeouts, identity-change cancellation and CSV formula-injection protection.
- Finder reuses the existing catalog; changing preferences adds no AI API calls or database reads. It refuses new matches while the catalog is unavailable/stale. Checkout still revalidates actual availability.
- No external AI provider, new recurring AI charges, preference tracking or customer-data transfer was added.

## Production data readiness observed

Snapshot at release: 54 complete history days, seven active days, eight eligible settled orders, 72 provider test-mode payments excluded, and one paid record without a usable settlement date. Consequently production predictions are intentionally withheld until genuine history satisfies readiness. Paid COD has no provider test flag; staff must distinguish demonstration COD from genuine trading. Current-status reconciliation is retrospective, not archived as-of backtesting.

## Verification

- `npm run verify`: 514 tests across 77 files, TypeScript and production build passed.
- `node scripts/test-intelligence-db.mjs`: isolated PostgreSQL 17 fixture tests passed for settlement dates, exclusions, cache reuse, role/MFA denials, aggregates, exports and empty history.
- `node scripts/release-intelligence-db.mjs`: live-schema query validation passed in a rolled-back transaction. Session-local probe copies checked real schema compatibility without changing production auth helpers or public authorization checks.
- Targeted migration applied and recorded as `20260922090000`. The two existing mobile-only migration records were preserved; no history repair/reversion was used.
- Anonymous HTTP requests to all three production report RPCs returned 401.
- Browser: live-catalog sofa budget matches, six-per-page pagination, width/depth limits, keyboard submit, no-match response and result focus verified. Forecast worker, live/demo switching, order metric, 14-day table and explicit demo labelling verified with local fixtures. No forecast-page console errors observed.
- Responsive overflow checks passed at 320, 390, 768 and 1280 CSS pixels for the forecast; finder checked at 320/390 and desktop. These are browser viewport checks, not physical iOS/Android certification.
- Local desktop timing (112-day fixture, 30 calculations): approximately 0.52 ms median / 0.99 ms p95. This is not a production-device latency guarantee.

## Release and verification limits

Netlify production deploy: `6ab20b272398cc280bc43c9a` at https://www.cozycraftfurnitures.com. Production shell/security-header checks passed for 19 routes; five entry asset hashes matched the verified local build. The published finder returned four live sofas within a PHP 25,000 budget and 150 × 90 cm limits, with no browser console errors observed. All 91 active catalog products were recognized by type; 74 have supported overall-width values and 56 have supported depth values. Other measurements are not guessed.

No authenticated production administrator login was altered or created for testing. Admin rendering was tested with local fixtures plus real-schema database validation; these are not a full live authenticated browser journey. No real purchases, customer profile changes, SMS or emails were generated by this release.

The existing build warning for the large lazily loaded HEIC conversion dependency remains outside this feature. Browser and network conditions can still introduce delay; this release does not promise zero latency or forecasting accuracy.

## Reproducing QA

`node scripts/preview-intelligence.mjs` opens a localhost-only synthetic UI at port 5179. It is not a production route. The database fixture script uses the specifically named isolated Docker container `cozy-intelligence-qa`. Release validation defaults to rollback; `--apply` is an explicit one-time migration application and fails if already applied.
