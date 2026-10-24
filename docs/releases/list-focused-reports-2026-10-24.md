# List-focused administrator PDF exports

Scope: the shared Orders / Payments PDF presentation only. The large total order
value, settled sales, pending collection and refunded value cards are removed.
The database, financial calculations, on-page admin cards, export filters, CSV
schema, access controls and reporting service are unchanged. No migration or
additional database request is introduced.

## Presentation

- Compact logo, title, generation timestamp, record count and active filters.
- Print-friendly white pages, olive table header and subtle row/detail bands.
- Sequential row numbers with space for the full 5,000-record PDF export limit.
- Readable status text with restrained color; right-aligned currency values.
- Repeated headings, confidentiality footer, Philippine time label and page count.
- Long names wrap; ordinary records keep their optional details together.
- Oversized details continue onto another page with an explicit order reference.
- Keep per-record totals, environment labels and selected optional details.

## Verification

- Tests inspect compressed PDF text for all 80 fixture records, absence of the
  four aggregate cards, filters/amounts, optional details, empty results and
  oversized continuation sections.
- Browser fixtures download both PDF and CSV for Orders and Payments at
  320/390/1440px, retaining filters and checking real downloaded PDF content.
- Generated previews and detailed fixtures were rendered with Poppler. PDF
  text/geometry checks cover every fixture record, header/footer and page bound.
- Full release and responsive browser suites are run before publication.
- Preview artifacts use synthetic fixtures, not customer records. No production
  order/customer data was modified to test this presentation change.

The release audit found DOMPurify advisories in jsPDF's optional dependency.
The lockfile is updated from 3.4.16 to 3.4.17 without changing jsPDF or other
packages; the dependency audit then reports zero vulnerabilities.

Commands: `npm run verify:release`, `npm run test:browser`,
`node scripts/preview-commerce-reports.mjs`, `npm audit --audit-level=high`.
