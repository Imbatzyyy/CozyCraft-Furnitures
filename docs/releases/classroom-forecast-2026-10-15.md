# Classroom forecast and approved restock — 2026-10-15

## Scope and data integrity

The user approved a separate synthetic classroom dataset, setting only previously out-of-stock products to 25 units, and deploying/pushing the tested source selector. The large synthetic warning and repeated scenario badge were subsequently removed at the user's request. A compact `Classroom dataset · not actual sales` line, simulated metric names, source metadata and CSV provenance remain.

- Real store data remains the default. Classroom history is fetched only after explicit selection.
- The saved scenario contains 112 complete Philippine calendar days through 2026-10-14, 580 simulated orders and 107 active days. Refresh does not shift dates or regenerate history.
- No synthetic orders, payments, profiles, loyalty entries or email jobs were inserted into commerce tables. Existing live forecasting SQL is unchanged.
- The existing forecasting engine fits and chronologically validates the selected input. Validation against this classroom scenario does not establish real-store accuracy.
- CSV exports retain the dataset ID and explicit synthetic provenance so exported figures cannot be mistaken for actual revenue.

## Database release

Applied only `20261015090000_classroom_forecast_dataset.sql` to project `gwjsivqksyimuabbdyqq` and recorded it in migration history.

The new private RLS table is not exposed directly to authenticated customers or anonymous callers. `admin_classroom_forecast_inputs()` enforces existing staff and MFA guards. The response is approximately 5.9 KB (112 daily aggregates), not full order rows. It does not add a realtime publication, polling loop, external AI call or scheduled dataset generator. Calculation uses the existing worker with a bounded fallback.

One-time inventory update, separately audited:

| Product | Before | After |
| --- | ---: | ---: |
| GRÅFJÄLLET (`gr-fj-llet`) | 0 | 25 |
| KNARREVIK (`knarrevik`) | 0 | 25 |
| MALMM (`malmm`) | 0 | 25 |
| TARVA (`tarva`) | 0 | 25 |

All 87 previously positive inventory values and other product fields were preserved. The transaction verified four inventory-movement entries and corresponding realtime availability signal timestamps. The restock script refuses to run a second time; it must not reset stock consumed by later orders.

## Verification

- TypeScript, 99 frontend/unit test files, 629 tests and Vite production build passed after the final UI wording changes.
- Database readiness and classroom isolation tests passed.
- 20 Edge Function tests with 8 nested steps passed; no provider payments or email sends were performed.
- Shared-backend manifest contains 133 unique matching migration versions.
- Production dependency audit reported zero known vulnerabilities at verification time; this is not a security certification.
- Installed-schema verification passed all 11 assertions: unchanged live RPC, anonymous denial, private table, no realtime publication, MFA denial, source classification, bounded history, totals, stable refresh, separate live source and customer denial.
- Local browser QA used the database-derived classroom aggregate snapshot: desktop 1280 px and mobile 390/320 px, no horizontal page overflow; sales/order toggles, 7/14-day horizons and expandable forecast tables checked. No browser console errors observed.
- The source-selector tests cover fresh entry, explicit selection, source/identity race protection, identity reset, malformed replies and RPC failures without fallback to the other data source.

Proof limits: local viewport checks are not physical-device testing. SQL role tests do not replace an authenticated hosted admin browser journey. No new 45-person simultaneous load test was run for this release. An existing optional HEIC asset build-size warning remains unchanged.

## Recovery

The previous frontend can be redeployed without deleting classroom data; its live RPC is unchanged. The additive table/RPC can remain unused. Do not automatically reverse inventory to zero or delete audit entries: reconcile subsequent orders and reservations before any separately authorized stock correction. Do not roll back unrelated migrations.

Recheck installed data without reapplying the migration:

```sh
node scripts/release-classroom-forecast.mjs --installed
```
