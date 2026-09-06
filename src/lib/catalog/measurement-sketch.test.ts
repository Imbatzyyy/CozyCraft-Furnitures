import { describe, expect, it } from "vitest";
import { sketchAxes, sketchKind, sketchMeasure } from "./measurement-sketch";

describe("safe sketch dimension guides", () => {
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
