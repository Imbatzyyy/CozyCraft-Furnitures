import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductMeasurements } from "./ProductMeasurements";

describe("product-specific measurement reference", () => {
  it("uses the supplied product photo without cropping and keeps original units", () => {
    const html = renderToStaticMarkup(<ProductMeasurements name="WLIVE" image="/wlive.jpg" specs={[{label:"Width",value:"58.3",unit:"in"}]} />);
    expect(html).toContain('/wlive.jpg');
    expect(html).toContain('object-contain');
    expect(html).toContain('58.3 in');
    expect(html).not.toContain('<svg');
  });
  it("shows combined, diameter, and secondary measurements without guessing axes", () => {
    const html = renderToStaticMarkup(<ProductMeasurements name="Table" image="/table.jpg" specs={[{label:"Diameter",value:"120 x 76",unit:"cm"},{label:"Seat height",value:"45",unit:"cm"}]} />);
    expect(html).toContain('120 x 76 cm');
    expect(html).toContain('Seat height');
    expect(html).not.toContain('Width');
  });
  it("does not disappear or fabricate dimensions when catalog data is missing", () => {
    const html = renderToStaticMarkup(<ProductMeasurements name="Chair" image="" specs={[]} />);
    expect(html).toContain('Product photo unavailable');
    expect(html).toContain('Measurements are not yet available');
  });
});
