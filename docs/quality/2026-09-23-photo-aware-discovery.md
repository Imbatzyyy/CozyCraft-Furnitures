# Photo-aware furniture discovery — 23 September 2026

## Scope

Improve Find My Furniture's natural-language requirements and understanding of existing public catalog photos. No customer image uploads, chatbot changes, mobile changes, or checkout changes.

## Changes

- Shared the existing 45-subcategory taxonomy between administration, the interpreter, and deterministic matching. All 91 currently active products have a recognized furniture type.
- Interpret English and Filipino descriptions with an allowlisted structured response. Apply product type, budget, colour, material, requested features, and overall size as requirements, not merely ranking hints. Rank only eligible products.
- Recover explicit colour exclusions and specific product types; distinguish true subtypes (for example, pantry cabinets) from cross-cutting attributes (for example, wood and storage on a coffee table).
- Ask for clarification for unsupported exact shades, ambiguous size requests, unsupported conditions, or incompatible interpretations. Do not silently substitute unrelated products.
- Match colour from administrator-confirmed catalog colour or a current, usable product-photo observation. Display that provenance. Photos do not establish dimensions or material composition.
- Analyze up to two existing product photos once per changed photo set. Cache compact public observations; reuse the existing catalog rather than uploading or re-reading photos per customer search.
- Detect actual image format rather than trusting a filename. Some catalog `.jpg` objects contain AVIF. Convert those in memory for the vision provider; original product images remain untouched.
- Add a service-only retry queue and one-product-per-minute worker, bounded retries, daily budgets, provider cooldown handling, and stale-photo protection. No provider call occurs when the queue is empty.
- Preserve search correctness when requests fail or are edited/reset in flight. Keep six results per page and provide interpretable requirement chips and no-match explanations.
- Let administrators maintain confirmed product colour; database photo-change triggers keep indexing recoverable if an administrator leaves the page.

## Release verification

- `npm run verify`: TypeScript check, **539 tests across 78 files**, and production build passed.
- Edge handler tests: **8 passed**. Checks cover request limits, input validation, authorization/MFA boundaries, rate limits, provider errors, cache reuse, and image validation.
- `npm run smoke:prod`: HTTP shell checks passed for 19 routes, security headers, robots.txt, and sitemap.xml. These checks alone do not execute route JavaScript.
- Deployed entry JavaScript, CSS, and shared vendor assets match the local build byte-for-byte.
- Production browser search: grey two-seater fabric sofa under PHP 15,000, maximum width 150 cm, excluding leather returned GLOSTAD at PHP 5,999 with 121 W x 78 D cm and photo-observed grey provenance.
- Production browser search: blue velvet sofa under PHP 10,000 returned no confirmed matches, without relaxing criteria.
- Production browser search: navy blue sofa requested clarification instead of claiming exact-shade confirmation.
- Reset restored the initial state. Browser error/warning log was empty for this live sequence.
- Responsive browser checks at 320 and 390 CSS pixels showed no horizontal overflow; desktop layout was also checked. This is not a claim of physical-device coverage across all browsers.
- Live anonymous indexing returned HTTP 401. Database privileges deny public profile writes and public access to the private queue and service-only mutation RPCs.
- Both targeted migrations are recorded in production. Unrelated mobile migration history was preserved.

Frontend release: Netlify deployment `6ab317371ae577465ec3e686` at <https://www.cozycraftfurnitures.com/find-my-furniture>. The `furniture-discovery` function was deployed separately with the final intent guards.

## Honest limitations and follow-up

At the final recorded indexing snapshot, **23 of 91** active product photo profiles were complete, with **68 queued**, **0 exhausted**, and the worker enabled. Indexing continues independently in the database worker under provider limits. The page displays coverage; unprocessed or uncertain photos are not represented as verified colour matches. Completion time depends on provider capacity and retries.

Ten catalog records need measurement confirmation before every size constraint can be safely evaluated: `lyle`, `fitueyes`, `bergsbo-heim-image-`, `perlesmith`, `paulette`, `paul`, `edison`, `grimo-heim`, `hielivv`, and `vimle`. Issues include unlabeled dimension triples, corner/sectional footprints, and implausible units. These measurements were not guessed or overwritten; products with unknown required dimensions are excluded from size-constrained matches.

Exact shades, lighting-dependent colour, hidden mechanisms, actual material composition, and physical fit cannot be guaranteed from photos. Listed bed/table length is used where appropriate; extendable tables use maximum length, not their folded size. Seat and mattress measurements are not substituted for overall furniture measurements.

Provider response time is nonzero and quotas still apply. Text interpretation and photo indexing use separate models, bounded calls, caching, and retry paths; no zero-latency guarantee is made. Administrator save/index initiation is source- and test-verified, but a real authenticated administrator product edit was not performed in production for this release.
