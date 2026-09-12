# CozyCraft Care: intelligence, reliability, and presentation pass

Status: released to production on 13 September 2026. The website and `cozycraft-assistant` Edge Function were deployed together, then checked against live public requests. No database migration or mobile application edit was required. Legacy `reply`, `model`, `fallback`, and health-probe responses remain compatible with existing callers.

- Website: [production deployment](https://6aa57f6bf6f826c5863f23d5--cozycraft-furnitures.netlify.app), also published at [CozyCraft Furnitures](https://www.cozycraftfurnitures.com).
- Supabase: `cozycraft-assistant` version **43**, verified **ACTIVE**.
- Published HTML and primary JavaScript/CSS SHA-256 hashes match the verified local build.

## Confirmed problems and changes

| Finding in the previous implementation | Implemented correction |
| --- | --- |
| Broad keywords such as payment, account and delivery bypassed generation and returned the same generic paragraph. | Twenty task-specific website guides; only simple procedural questions and exact account-status questions use deterministic answers. Nuanced troubleshooting, multi-part questions and language-specific replies receive the relevant guide and data in the model context. |
| Product search silently widened a failed budget/type filter back to all products. | Hard budget/type constraints, shorthand budgets, updated follow-up preferences, stock-aware recommendations, current-product context, and explicit no-match guidance. |
| An explicit order number could be ignored in favor of the latest order. | Exact order-number lookup under the authenticated owner filter. A missing requested order never substitutes another order. |
| The latest 20 orders were treated as a complete account history. | Bounded recent-order wording, no unsupported account-wide counts, direct users to full history for older records. |
| Missing settings and zero-valued settings could produce assumed fees and time windows. | Preserve zero; missing data is unavailable, never an invented default. Payment, delivery, return and refund statuses remain separate. |
| Every signed-in question fetched profile, addresses, orders, cart, wishlist, tickets, returns, notifications and loyalty records. | Only relevant orders/timeline, loyalty/vouchers, return statuses or ticket statuses are fetched. No full addresses, private profile details, staff notes or free-text support replies enter model context. |
| Cached public knowledge was populated through the caller's authenticated client. | A separate anonymous client supplies the shared public cache; account reads never enter shared caches. Concurrent public refreshes are deduplicated. |
| The frontend retried 429/server errors automatically and also issued heartbeat/focus health requests. | No opening or recurring health calls; explicit manual retry, cooldown, synchronous duplicate-submit lock and bounded request lifetime. |
| Frontend allowed 2,000 characters but the server silently truncated to 800. | Consistent 2,000-character limit with explicit input/body-size errors. |
| Raw markup/paths could appear in customer-facing messages. | Plain-text normalization, semantic paragraphs/numbered lists, verified internal navigation buttons, and no HTML rendering. |
| Long requests could leave the composer disabled, or late replies could outlive account changes. | Timeout/retry states, abort and generation guards, verified frontend conversation owner, tab-only expiring conversation context. |
| Review and membership help lagged behind the website. | Guidance includes approval-free eligible reviews, voucher conversion confirmation, wallet expiry checks, checkout vouchers, password setup, phone uniqueness/re-verification, payment preferences, receipts and device security. |
| Live provider checks revealed that the configured model was unavailable; nuanced questions silently fell back to procedural guides. | Default to the supported `openai/gpt-oss-20b` model through the existing Groq service. Honor working configured models; recover once only from an explicit unavailable-model error and cache the working replacement for 15 minutes. Authentication/quota errors do not trigger model switching. Safe categorical diagnostics never expose raw provider errors or prompts. |

## Customer experience

- Responsive floating chat with a scrollable transcript and persistent composer.
- Narrow-screen and visual-viewport accommodation, background scroll lock, Escape close, keyboard focus containment and restoration.
- Context-sensitive suggested questions, named page actions, direct support access, and deliberate new-conversation controls.
- English, Filipino and Taglish scope recognition; provider prompt follows the customer's language. Safe provider-outage help is primarily English.
- Read-only assistance: never silently places orders, reserves stock, changes credentials, submits support cases or issues refunds.
- Obvious credential/OTP/card-number input is stopped before sending/persistence. This is a best-effort guard, not a universal sensitive-data detector.

## Verification completed

- `npm run verify`: TypeScript, **472 tests / 72 files**, production build pass.
- `npx --yes deno check supabase/functions/cozycraft-assistant/index.ts`: pass.
- `npx --yes deno test --allow-env supabase/functions/cozycraft-assistant/handler_test.ts`: **1 contract test / 8 steps**, pass. Database and provider responses are isolated fixtures; no network permission is granted to these tests.
- `npm audit --audit-level=moderate`: zero known vulnerabilities.
- Browser fixture preview at **390×844**, **320×480**, and **1280×900**: no document horizontal overflow; composer remains visible; Home Circle button navigates to the expected profile tab; no captured browser console errors.
- Manual mobile/desktop visual review of structured replies, semantic lists and labelled actions.
- Automated regressions cover offline drafts, stuck requests, explicit retry without duplicate messages, rapid duplicate submission, account-change races, sensitive-input rejection, expiry, safe URLs, zero settings, exact orders, no-match product constraints and provider failure.
- Real public API requests: AI-generated payment-pending troubleshooting, Filipino phone-change guidance, and a no-match answer for a sofa under PHP 1,000 all returned HTTP 200. A voucher how-to returned the grounded website guide; unrelated Python coding help was declined.
- Live browser: voucher guidance rendered numbered steps and `/profile?tab=home-circle`; a subsequent payment question received an AI reply with payment-status navigation and no duplicate-payment advice. At **390×844**, the panel and composer stayed within the viewport with no horizontal overflow and no captured console errors. Escape closed the panel, restored the launcher focus, and released the background scroll lock.
- `npm run smoke:prod`: 17 route HTTP shells, security headers, robots.txt and sitemap.xml passed. These HTTP checks do not execute route JavaScript or replace end-to-end account testing.

The existing lazy HEIC decoder still produces the known large-chunk build warning; it is not introduced or eagerly loaded by this chatbot change.

## Release and verification boundaries

The local preview (`node scripts/preview-care-chat.mjs`) is deliberately fixture-only and does not prove production model quality. The release additionally used a small set of real, public synthetic questions against the existing AI provider and the deployed browser UI. No authenticated production account write, payment, OTP, SMS or email action was performed. Chrome-family browser checks are not a claim of physical iPhone, Safari or Firefox verification.

Authenticated order ownership, exact-order lookup and failure handling were verified using isolated backend fixtures, not a live customer account. A further designated-account acceptance pass should check older explicit orders, pending paid orders, voucher eligibility, product measurements and follow-up preferences. Do not use real customer secrets in prompts. These checks and the public live sample do not guarantee correctness for every generated response.

## Recommended next improvements

1. Maintain a versioned answer-quality evaluation set and rerun it when the model, policies, or account workflows change. Automated fixture tests validate behavior boundaries but cannot certify a generative model against every hallucination or prompt attack.
2. Add privacy-minimized helpful/not-helpful feedback only with an agreed retention policy; aggregate answer category and error type rather than retaining raw customer conversations by default.
3. Move the public catalog to server-side indexed search if it grows beyond the bounded 500-record snapshot. The assistant already marks a capped catalog as incomplete rather than claiming exhaustive knowledge.
4. Give staff a maintained, published FAQ workflow for actual recurring questions. Customer support remains the correct path for discretionary refunds, account identity checks, delivery exceptions and legal/tax documentation.

Technical references used: [Groq chat-completion documentation](https://console.groq.com/docs/text-chat) for bounded provider requests, [Groq model deprecations](https://console.groq.com/docs/deprecations) for the live unavailable-model diagnosis, and [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) for layered input, data-boundary and output safeguards. These controls reduce risk; they do not guarantee that all malicious prompts or incorrect generated answers are prevented.
