# Mobile Care navigation reference — October 16, 2026

The shared assistant now distinguishes mobile requests (`client: mobile`) from
website requests. The canonical `cozycraft-mobile-pages.ts` describes 30
customer-facing mobile destinations, parent-page workflows, and exact labels.
Its reviewed snapshot is bundled with Mobile 1.0.85; verify parity with the
mobile repository's `scripts/sync-assistant-pages.mjs <website checkout>`.

Mobile guidance uses the in-app menu and Account links, including Developers,
Company History, Contact Us, Terms and Privacy. Invoice guidance uses
**Request an invoice** on a delivered order; payment continuation explains the
available payment window and warns against retrying after a charge. Website
receipt guidance is unchanged. The mobile Developers roster includes Sammuel
Guill Concepcion and is explicitly distinct from historical founding records.

An app-page overview is answered without database or AI calls. Existing scope,
privacy, authorization and live-record checks remain intact. No database
migrations or customer/order mutations are included.

Validation: 711 website tests, TypeScript/build, and 21 Edge tests plus 10 handler
substeps passed locally. Handler fixtures verify the mobile reference reaches
the provider, the page overview makes no external calls, and invoice guidance
does not fall back to website receipt instructions. Native UI/build evidence is
recorded separately in the Mobile 1.0.85 release notes.
