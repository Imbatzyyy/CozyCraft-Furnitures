import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductMeasurements } from "./ProductMeasurements";

describe("product-specific measurement reference", () => {
  it("renders a line sketch, converts the guide to cm, and keeps original specifications", () => {
    const html = renderToStaticMarkup(<ProductMeasurements name="WLIVE" type="Modern TV Stand" specs={[{label:"Width",value:"58.3",unit:"in"}]} />);
    expect(html).toContain('<svg');
    expect(html).toContain('W 148.08 cm');
    expect(html).toContain('58.3 in');
    expect(html).not.toContain('<img');
  });
  it("shows combined, diameter, and secondary measurements without guessing axes", () => {
    const html = renderToStaticMarkup(<ProductMeasurements name="Table" type="Glass Dining Table" specs={[{label:"Diameter",value:"120 x 76",unit:"cm"},{label:"Seat height",value:"45",unit:"cm"}]} />);
    expect(html).toContain('120 x 76 cm');
    expect(html).toContain('Seat height');
    expect(html).not.toContain('Width');
  });
  it("does not disappear or fabricate dimensions when catalog data is missing", () => {
    const html = renderToStaticMarkup(<ProductMeasurements name="Chair" type="Dining Chair" specs={[]} />);
    expect(html).toContain('<svg');
    expect(html).toContain('Measurements are not yet available');
  });
});
