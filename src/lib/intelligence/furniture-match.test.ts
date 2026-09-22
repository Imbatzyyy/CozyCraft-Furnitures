import { describe, expect, it } from "vitest";
import type { Product } from "@/app/core";
import { emptyPreferences, furnitureType, measurementCm, trainFurnitureMatcher } from "./furniture-match";

const product = (overrides: Partial<Product> = {}): Product => ({ id: "one", name: "Oak", category: "Living room", subcategory: "3-Seater Fabric Sofa", price: 20000, stock: "In stock", stockQuantity: 3, status: "active", color: "Beige", material: "Fabric", dimensions: "190W × 80D × 85H cm", description: "Modern fabric seating", images: [], rating: "0", reviews: 0, ...overrides });
describe("catalog-trained furniture recommendations", () => {
  it("keeps budget and exact type firm even with persuasive description matches", () => {
    const model = trainFurnitureMatcher([product(), product({ id: "costly", price: 30000 }), product({ id: "table", subcategory: "Coffee Table", description: "Sofa modern fabric seating" })]);
    expect(model.match({ ...emptyPreferences, type: "Sofa", budget: 25000 }).matches.map(m => m.product.id)).toEqual(["one"]);
  });
  it("returns no matches rather than widening a budget", () => {
    expect(trainFurnitureMatcher([product()]).match({ ...emptyPreferences, budget: 100 }).matches).toEqual([]);
  });
  it("excludes drafts, unknown stock and sold-out products", () => {
    const model = trainFurnitureMatcher([product({ status: "draft" }), product({ id: "zero", stockQuantity: 0 }), product({ id: "unknown", stockQuantity: undefined })]);
    expect(model.match(emptyPreferences).matches).toEqual([]);
  });
  it("does not recommend placeholder products without an active status", () => {
    expect(trainFurnitureMatcher([product({ status: undefined })]).catalogSize).toBe(0);
  });
  it("enforces dimensions and accounts for missing values", () => {
    const model = trainFurnitureMatcher([product(), product({ id: "missing", dimensions: "" })]);
    expect(model.match({ ...emptyPreferences, width: 180 }).matches).toEqual([]);
    const fits = model.match({ ...emptyPreferences, width: 190, depth: 80 });
    expect(fits.matches).toHaveLength(1); expect(fits.missingMeasurements).toBe(1);
  });
  it("does not read seat width as overall width or guess ambiguous ranges", () => {
    expect(measurementCm(product({ dimensions: '[{"label":"Seat width","value":"150","unit":"cm"}]' }), "width")).toBeNull();
    expect(measurementCm(product({ dimensions: '[{"label":"Width","value":"150-190","unit":"cm"}]' }), "width")).toBeNull();
  });
  it("converts units for firm measurement constraints", () => {
    expect(measurementCm(product({ dimensions: "2W × 1D × 1H m" }), "width")).toBe(200);
    expect(measurementCm(product({ dimensions: "50W × 20D × 30H in" }), "width")).toBe(127);
  });
  it("reads imported metric values with equivalent imperial annotations", () => {
    const dimensions = JSON.stringify([{ label: "Width", value: '121 (47 5/8 \\")', unit: "cm" }, { label: "Depth", value: '78 (30 3/4 \\")', unit: "cm" }]);
    expect(measurementCm(product({ dimensions }), "width")).toBe(121);
    expect(measurementCm(product({ dimensions }), "depth")).toBe(78);
    expect(measurementCm(product({ dimensions: JSON.stringify([{ label: "Width", value: "121 (minimum)", unit: "cm" }]) }), "width")).toBeNull();
  });
  it("ranks a material match above an unrelated finish", () => {
    const model = trainFurnitureMatcher([product({ id: "fabric", price: 1000 }), product({ id: "velvet", material: "Velvet", description: "Soft velvet upholstery", price: 2000 })]);
    const match = model.match({ ...emptyPreferences, finish: "velvet" });
    expect(match.matches[0].product.id).toBe("velvet"); expect(match.matches[0].reasons.join(" ")).toContain("velvet");
  });
  it("never invents a verified reason based on description alone", () => {
    const match = trainFurnitureMatcher([product({ description: "Scandinavian appearance" })]).match({ ...emptyPreferences, style: "Scandinavian" });
    expect(match.matches[0].reasons.join(" ")).not.toContain("scandinavian");
  });
  it.each([NaN, Infinity, -1, 0])("rejects invalid constraint %s", budget => {
    const result = trainFurnitureMatcher([product()]).match({ ...emptyPreferences, budget });
    expect(result.error).not.toBe(""); expect(result.matches).toEqual([]);
  });
  it("classifies product identity, including sofa beds", () => {
    expect(furnitureType(product({ subcategory: "Sofa Bed" }))).toBe("Sofa");
    expect(furnitureType(product({ subcategory: "Wooden Ornate Dining Chairs" }))).toBe("Dining chair");
    expect(furnitureType(product({ subcategory: "Nightstand with Drawer" }))).toBe("Nightstand");
  });
  it("sorts equal matches deterministically and recomputes changed availability", () => {
    const a = product({ id: "b" }), b = product({ id: "a" });
    expect(trainFurnitureMatcher([a, b]).match(emptyPreferences).matches.map(m => m.product.id)).toEqual(["a", "b"]);
    b.stockQuantity = 0;
    expect(trainFurnitureMatcher([a, b]).match(emptyPreferences).matches.map(m => m.product.id)).toEqual(["b"]);
  });
});
