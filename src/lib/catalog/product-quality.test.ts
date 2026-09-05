import { describe, expect, it } from "vitest";
import { measurementCm, productQualityGaps } from "./product-quality";
describe("trustworthy product measurements", () => {
  it.each([["cm",100,100],["mm",1000,100],["m",1,100],["in",10,25.4],["ft",1,30.48]])("converts %s before comparing room dimensions", (unit,value,expected) => {
    expect(measurementCm([{label:"Width",value:String(value),unit:String(unit)}],"width")).toBe(expected);
  });
  it.each(["", "40-60", "100 x 120", "-2", "NaN", "0"])("does not guess ambiguous size %s", (value) => {
    expect(measurementCm([{label:"Width",value,unit:"cm"}],"width")).toBeNull();
  });
  it("does not treat seat width as overall width or assume missing units", () => {
    expect(measurementCm([{label:"Seat width",value:"40",unit:"cm"}],"width")).toBeNull();
    expect(measurementCm([{label:"Width",value:"40",unit:""}],"width")).toBeNull();
  });
  it("flags real catalog gaps without inventing product information", () => {
    const gaps=productQualityGaps({name:"Table",description:"Short",images:[],price:0,category:"Dining room",material:"",dimensions:""});
    expect(gaps).toContain("Four product photos");
    expect(gaps).toContain("Clear width, depth and height with units");
    expect(gaps).not.toContain("Product name");
  });
});
