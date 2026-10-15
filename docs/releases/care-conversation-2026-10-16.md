# CozyCraft Care — Conversation-first answers

October 16, 2026. Companion to mobile **1.0.84**.

## Cause and fix

The live greeting was already friendly, but the mobile formatter interpreted
the word "choose" in "I can help you choose furniture" as an instruction and
wrapped the greeting in a WHERE TO GO card. It also treated every numbered
list as directions. Separately, the provider prompt required steps for almost
every answer, and the generic fallback asked which screen the user needed.

- Add bounded, exact conversational intents for greetings, availability,
  assistant identity, capabilities, CozyCraft basics, bag/wishlist definitions,
  thanks and goodbyes, with English/Filipino variants.
- Return those safe, static answers without navigation actions, database reads
  or paid AI calls. Security/privacy checks still run first. A greeting prefix
  never hides an actual payment, product, or order question.
- Ask the provider for a direct answer first; use steps only for navigation,
  procedures, or troubleshooting. The fallback asks about the concern rather
  than demanding a page name.
- The mobile formatter recognizes actual imperative instructions, preserves
  ordinary numbered product lists, and derives buttons only from directions.
  Actual support navigation continues to work.

## Verification and deployment

- Website: **678 tests**, TypeScript/build, disposable database checks,
  **21 Edge tests with 9 substeps**, migration-manifest and production audits
  passed. New coverage includes mixed greeting/questions, previous order
  history, and zero backend/provider requests for basic conversation.
- Live `cozycraft-assistant` function **44** is active. Six live conversational
  probes returned the new direct answers with no action buttons. A separate
  live payment-method question reached the AI provider and answered the question
  directly without a navigation tutorial.
- Website deployment: `6ad13f1b5b7f6f629331ca07`,
  https://www.cozycraftfurnitures.com. HTTP/security checks passed for 19 routes.
- Mobile: **390 storefront tests**, **25 shell tests**, **11 toolchain tests**,
  typecheck, lint, backend ownership and runtime dependency audits passed.
- Chat UI: **8 layouts / 56 message interactions** passed in Chromium/WebKit,
  at 320, 390, 768 and 844-landscape widths. Includes the original greeting,
  Taglish greeting, basic questions, numbered product results, usable composer,
  no horizontal overflow, and a real support-button navigation action.

No schema, payments, customer records, notification credentials, or historical
orders were changed. The shared backend helps existing clients immediately;
the parser fix requires installing mobile 1.0.84. Native build/distribution
details are recorded in the mobile repository's `docs/releases/1.0.84.md`.
