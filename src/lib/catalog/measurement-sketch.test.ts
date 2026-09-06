import { describe, expect, it } from "vitest";
import { sketchAxes, sketchKind, sketchMeasure } from "./measurement-sketch";
import catalog from "./measurement-catalog.fixture.json";

describe("safe sketch dimension guides", () => {
  it.each([
    ["ALBA", 90, 180, 75], ["ALBIE", 120, null, 76],
    ["Eris", 100, 220, 75], ["HEAVENLY YOUTH 55", 140.21, 23.5, 30],
    ["HEMLINGBY", 145, 71.5, 71.5], ["VIHALS", 156, 206, 66],
    ["VIMLE", 330, 98, 80],
  ])("renders researched axes for %s", (name, width, depth, height) => {
    const product = catalog.find(p => p.name === name)!;
    const specs = JSON.parse(product.dimensions);
    const axes = sketchAxes(specs, sketchKind(product.subcategory, specs));
    expect(axes.width?.cm ?? null).toBe(width);
    expect(axes.depth?.cm ?? null).toBe(depth);
    expect(axes.height?.cm ?? null).toBe(height);
    if (name === "VIMLE") expect(axes.width?.label).toBe("Width left");
  });
  it("reads cm with alternate inch text without reading the alternate as another axis", () => {
    expect(sketchMeasure([{label:"Width",value:'194 (76 3/8 ")',unit:"cm"}], ["width"])?.cm).toBe(194);
    expect(sketchMeasure([{label:"Diameter",value:'88 cm (34 5/8 ")',unit:"cm"}], ["diameter"])?.cm).toBe(88);
  });
  it.each(["90 x 180", "120-180", "0", "-1", "unknown"])("does not guess ambiguous measurement %s", value => {
    expect(sketchMeasure([{label:"Width",value,unit:"cm"}],["width"])).toBeNull();
  });
  it("reads explicitly labelled combined dimensions", () => {
    const axes=sketchAxes([{label:"Dimensions",value:'19.7"D x 47.2"W x 28"H',unit:"in"}],"tv-stand");
    expect(axes.width?.cm).toBe(119.89);
    expect(axes.depth?.cm).toBe(50.04);
    expect(axes.height?.cm).toBe(71.12);
  });
  it("does not mislabel mattress dimensions as bed-frame measurements", () => {
    expect(sketchAxes([{label:"Mattress width",value:"150",unit:"cm"}],"bed").width).toBeNull();
  });
  it("distinguishes specific furniture families", () => {
    expect(sketchKind("Sofa Bed",[])).toBe("sofa");
    expect(sketchKind("Bunk Bed",[])).toBe("bunk");
    expect(sketchKind("Floating TV Stand",[])).toBe("floating-tv");
    expect(sketchKind("Corner Wardrobe",[])).toBe("corner-wardrobe");
    expect(sketchKind("Glass Coffee Table",[{label:"Diameter",value:"88",unit:"cm"}])).toBe("round-table");
    expect(sketchKind("Future unknown furniture",[])).toBe("unknown");
  });
});
