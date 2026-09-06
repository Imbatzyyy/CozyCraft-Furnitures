# Product size sketches

The customer size panel uses inline isometric SVG furniture schematics, selected
from the product subcategory and dimension labels. It does not download another
image, request another catalog payload, or poll the database. These are furniture
type illustrations, not exact product CAD drawings or manufacturing plans.

`measurement-catalog.fixture.json` is a public-catalog regression snapshot of all
91 products on 2026-09-06. Every record must resolve to a supported sketch and
render without invalid SVG coordinates. New furniture types should add an
appropriate sketch before release; unknown types show an explicit fallback.

Measurement guides convert explicitly labelled dimensions to cm. Original
specifications remain available in the expandable list. Parenthesized alternate
units and explicitly labelled combined strings are supported. Unlabelled triples
are not assumed to be width/depth/height. Mattress dimensions are not presented
as bed-frame dimensions. Headboard/backrest/cushion heights retain their meaning.

## Catalog follow-up

Seven of the original ten incomplete records now have researched, labelled
measurements. See [the source audit](product-measurement-sources.md) for sources,
model matching and the guarded database migration. FITUEYES, HIELIVV and PERLESMITH
remain unresolved: unavailable guides show a dash rather than a guessed number.
This audit does not claim independent manufacturer verification of all 91 products.

## Verification

- Type checking, unit tests, all 91 catalog render cases, and production build.
- Browser layout checks at 320, 375, 390, 768 and 1280 px: 91 SVGs each,
  no horizontal overflow or clipped SVG labels.
- Visual review of 12 representative furniture sketches and the WLIVE product
  page at 375 and 1280 px. Physical-device testing is not claimed.
