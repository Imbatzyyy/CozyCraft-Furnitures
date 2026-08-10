import { describe, expect, it } from "vitest";
import {
  parseDimensionSpecs,
  parseMaterialSpecs,
  serializeDimensionSpecs,
  serializeMaterialSpecs,
} from "./product-specs";

describe("product specification compatibility", () => {
  it("parses legacy material bullets and preserves structured rows", () => {
    expect(parseMaterialSpecs("Oak — Solid frame\n• Fabric: Bouclé upholstery")).toEqual([
      { type: "Oak", description: "Solid frame" },
      { type: "Fabric", description: "Bouclé upholstery" },
    ]);
    expect(JSON.parse(serializeMaterialSpecs([{ type: " Oak ", description: " Frame " }]))).toEqual([
      { type: "Oak", description: "Frame" },
    ]);
  });

  it("parses compact and labelled dimensions without losing units", () => {
    expect(parseDimensionSpecs("76W × 78D × 74H cm")).toEqual([
      { label: "Width", value: "76", unit: "cm" },
      { label: "Depth", value: "78", unit: "cm" },
      { label: "Height", value: "74", unit: "cm" },
    ]);
    expect(JSON.parse(serializeDimensionSpecs([{ label: " Seat height ", value: " 45 ", unit: " cm " }]))).toEqual([
      { label: "Seat height", value: "45", unit: "cm" },
    ]);
  });

  it("returns editable empty rows for absent data", () => {
    expect(parseMaterialSpecs(null)).toEqual([{ type: "", description: "" }]);
    expect(parseDimensionSpecs("")).toEqual([{ label: "", value: "", unit: "cm" }]);
  });
});
