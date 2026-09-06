# Verified measurement audit — 2026-09-06

Seven of the ten incomplete catalog records were matched to published product
specifications. The migration changes only `dimensions`, with an exact ID and
previous-value guard per row. A conflict aborts the entire migration rather than
overwriting a newer administrator edit. Prices, inventory and images are untouched.

| Catalog product | Verified dimensions | Source and match |
| --- | --- | --- |
| ALBA | Width 90, length 180, height 75 cm | [HomeU ALBA](https://homeu.ph/products/alba-dining-table), matching description and existing 6-seater 90 × 180 size; separate the combined length field. |
| ALBIE | Diameter 120, height 76 cm | [Blims ALBIE](https://blimsfurniture.com.ph/products/albie-dining-table), matching tempered glass/ash base description and DIA120 × 76 specification. |
| Eris | Width 100, length 220, height 75 cm | [Home Atelier Eris](https://www.homeatelier.ph/products/white-marble-dining-table-in-brushed-gold), matching name and description; existing 100 × 220 selects the 8–10-seat variant. |
| HEAVENLY YOUTH 55 | Width 55.2, depth 9.25, height 11.81 inches | [HavenlyYouth seller listing](https://www.ebay.com/itm/157693759701) and [FN-TS059FG listing](https://www.global.ubuy.com/product/TMNESGRYI-55-floating-tv-stand-modern-entertainment-center-wall-mounted-media-console-shelf-for-under-tv-storage-tv-cabinet-for-living-room-bedroom). Matching rustic brown wall-mounted unit, two drawers and four shelves. Retailer evidence, not an independently obtained manufacturer drawing. Preserve catalog name. |
| HEMLINGBY | Width 145, depth 71.5, height 71.5 cm | [IKEA HEMLINGBY 70434368](https://www.ikea.com.hk/en/products/sofas-and-armchairs/sofas/hemlingby-art-70434368), Knisa dark grey 2-seat sofa. Corrects existing incorrect 75 cm width and 82 cm height as well as missing depth. |
| VIHALS | Frame width 156, length 206, height 66 cm | [IKEA Philippines VIHALS 80602441](https://www.ikea.com/ph/en/p/vihals-bed-frame-white-80602441/), frame for the existing 150 × 200 cm mattress. Preserve separate mattress measurements; never substitute them for frame dimensions. |
| VIMLE | Left width 330, right width 249 cm | [IKEA Philippines five-seat corner with chaise](https://www.ikea.com/ph/en/p/vimle-sectional-5-seat-corner-with-chaise-grann-bomstad-black-s09306765/). Matches existing 80 cm cushion height, 164 cm chaise, 98 cm depth, seat widths 273/192 and 4 cm clearance. Preserve the existing measurements; do not substitute the taller newer-market configuration. |

## Unresolved — do not guess

- **FITUEYES**: catalog lacks a model number. The existing 39.4 × 26.0 × 74.8-inch triple could not be matched reliably to a manufacturer model and axis diagram.
- **HIELIVV**: catalog photograph shows nesting round tables. No trustworthy matching specification for both tables was found. The stored 80 × 80 × 45 string is not sufficient evidence to assign diameter and height to the exact set.
- **PERLESMITH**: the existing 30.32 × 13.39 × 6.70-inch values appear to be packaging, not assembled cart measurements. Current PSTVMC01-C specifications differ from the pictured older cart. Do not substitute current-model base dimensions or TV mounting-center height for overall height.

These three records remain unchanged and retain unavailable sketch guides. Obtain
the purchase listing/model number or an assembled measurement drawing to resolve
them. Product schematics remain illustrative, not exact CAD drawings; measurements
are published supplier values, not measurements physically taken from stock.

## Performance

This is a one-time catalog correction. No new client fetch, subscription or polling
is added. Guides use the existing catalog payload and inline SVG renderer.
