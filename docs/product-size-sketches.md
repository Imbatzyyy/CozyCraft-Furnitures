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

Ten products have at least one missing or ambiguous overall measurement, so
unavailable guides show a dash instead of a fabricated number:

- ALBA, Eris: combined length field without explicit axis order.
- ALBIE: combined diameter field without separately specified height.
- FITUEYES, HEAVENLY YOUTH 55, HIELIVV, PERLESMITH: unlabelled combined dimensions.
- HEMLINGBY: no separate depth.
- VIHALS: mattress dimensions only.
- VIMLE: no overall width (seat widths are not overall widths).

Stored units and numerical accuracy have not been independently verified against
manufacturer documentation. This change does not alter the product database.

## Verification

- Type checking, unit tests, all 91 catalog render cases, and production build.
- Browser layout checks at 320, 375, 390, 768 and 1280 px: 91 SVGs each,
  no horizontal overflow or clipped SVG labels.
- Visual review of 12 representative furniture sketches and the WLIVE product
  page at 375 and 1280 px. Physical-device testing is not claimed.
