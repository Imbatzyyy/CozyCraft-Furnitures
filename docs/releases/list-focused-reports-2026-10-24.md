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

## Live-export freshness follow-up

The published deployment and the fresh HTML/JavaScript served from the canonical
domain, apex domain, Netlify domain and immutable deploy URL were verified to
contain the new list renderer. No deployment rollback was found. A pre-deployment
tab retaining old JavaScript, or reopening an identically named earlier download,
can still explain an old report; the user's specific tab could not be inspected
because local browser access was disabled.

- Both export dialogs now identify the PDF as `List layout v2 - no summary cards`.
- PDF downloads include Philippine generation time and `list-v2` in their names;
  CSV filenames and schema are unchanged.
- Before fetching report rows, PDF export makes one small uncached same-origin
  version-manifest request, bounded to six seconds. No polling or Supabase query
  is added. Offline/malformed checks fail visibly and can be retried.
- A mismatched version blocks the old PDF and offers a user-initiated full-page
  reload, preserving the current route. Existing pre-fix tabs still need one
  manual reload to obtain this protection; previously downloaded PDFs cannot
  be changed retroactively.
- When changing the PDF template in future, update the version in both
  `public/report-template.json` and `report-template-version.ts`. The browser
  regression uses the actual manifest to catch accidental mismatches.
- Browser regressions cover both exports at 320/390/1440px, stale-version and
  unavailable-manifest rejection before any report RPC/download, retry, and the
  reload action without losing the signed-in fixture session.

This follow-up changes no order/payment records, authorization, report filters,
financial calculations, or database schema.
