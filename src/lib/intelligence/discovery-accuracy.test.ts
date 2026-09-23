import { describe, it, expect } from "vitest";
import { guardIntent } from "../../../supabase/functions/_shared/discovery-intent-guards";
import type { Product } from "@/app/core";
import {
  trainFurnitureMatcher,
  emptyPreferences,
  measurementCm,
} from "./furniture-match";
import {
  blankIntent,
  photoKey,
  validateIntent,
  type VisualProfile,
} from "../../../supabase/functions/_shared/furniture-discovery";
import {
  materialTerms,
  productAttributes,
  featureTerms,
  normalize,
} from "./discovery-attributes";
const piece = (values: Partial<Product> = {}): Product => ({
  id: "sofa",
  name: "Sofa",
  category: "Living room",
  subcategory: "2-Seater Fabric Sofa",
  price: 10000,
  status: "active",
  stockQuantity: 2,
  color: "",
  material: "Fabric: Polyester upholstery",
  description: "Compact two-seater",
  dimensions: "150W × 80D × 90H cm",
  images: ["https://example.test/one.jpg"],
  rating: "0",
  reviews: 0,
  stock: "In stock",
  ...values,
});
const visual = (
  p: Product,
  values: Partial<VisualProfile> = {},
): VisualProfile => ({
  product_id: p.id,
  image_key: photoKey(p),
  version: 2,
  colors: ["grey"],
  appearance: ["fabric look"],
  features: ["two seater"],
  caption: "Grey fabric-looking two seat sofa",
  clarity: "clear",
  ...values,
});
describe("strict photo-aware discovery", () => {
  it("matches material and feature requests across descriptive catalog categories", () => {
    const intent = guardIntent("wooden coffee table with storage", {
      ...blankIntent(),
      type: "Coffee table",
      subtype: "Wooden Coffee Table",
      materials: ["wood"],
      features: ["storage"],
    });
    const p = piece({
      subcategory: "Storage Coffee Table",
      material: "Solid acacia",
      description: "A storage compartment",
    });
    expect(intent.subtype).toBe("");
    expect(
      trainFurnitureMatcher([p]).match({ ...emptyPreferences, intent }).matches,
    ).toHaveLength(1);
  });
  it("supports explicit bed axes, table length, redundant units and labelled triples", () => {
    expect(
      measurementCm(
        piece({
          subcategory: "Bunk Bed",
          dimensions: '[{"label":"Bed width","value":"97","unit":"cm"}]',
        }),
        "width",
      ),
    ).toBe(97);
    expect(
      measurementCm(
        piece({
          subcategory: "Extendable Dining Table",
          dimensions:
            '[{"label":"Length","value":"120","unit":"cm"},{"label":"Max. length","value":"170","unit":"cm"}]',
        }),
        "depth",
      ),
    ).toBe(170);
    expect(
      measurementCm(
        piece({
          dimensions:
            '[{"label":"Width","value":"88 cm (34 5/8 \\\")","unit":"cm"}]',
        }),
        "width",
      ),
    ).toBe(88);
    expect(
      measurementCm(
        piece({
          dimensions:
            '[{"label":"Dimensions","value":"11\\\"D x 55\\\"W x 6.9\\\"H","unit":"in"}]',
        }),
        "width",
      ),
    ).toBe(139.7);
  });
  it("rejects ambiguous triples, corner footprints and implausible chair units", () => {
    expect(
      measurementCm(
        piece({
          dimensions:
            '[{"label":"Dimension","value":"80 × 80 × 45","unit":"cm"}]',
        }),
        "width",
      ),
    ).toBeNull();
    expect(
      measurementCm(
        piece({
          dimensions:
            '[{"label":"Depth","value":"98","unit":"cm"},{"label":"Width left","value":"330","unit":"cm"}]',
        }),
        "depth",
      ),
    ).toBeNull();
    expect(
      measurementCm(
        piece({
          subcategory: "Wooden Ornate Dining Chairs",
          dimensions: '[{"label":"Width","value":"19","unit":"cm"}]',
        }),
        "width",
      ),
    ).toBeNull();
  });
  it("guards against omitted Filipino colours and unsupported exact shades", () => {
    const corrected = guardIntent("Puting cabinet, hindi black", {
      ...blankIntent(),
      type: "Storage",
      colors: ["black"],
    });
    expect(corrected.colors).toEqual(["white"]);
    expect(corrected.excludedColors).toEqual(["black"]);
    expect(
      guardIntent("navy blue sofa", {
        ...blankIntent(),
        type: "Sofa",
        colors: ["blue"],
      }).clarification,
    ).toContain("exact shade");
    expect(
      guardIntent("pantry cabinet", { ...blankIntent(), type: "Storage" })
        .subtype,
    ).toBe("Pantry Cabinets");
  });
  it("does not mistake hidden wood frames for wooden upholstery", () => {
    const p = piece({
      material:
        '[{"type":"Frame","description":"Solid pine"},{"type":"Cover Fabric","description":"Polyester"}]',
    });
    expect(
      trainFurnitureMatcher([p]).match({
        ...emptyPreferences,
        material: "wood",
      }).matches,
    ).toHaveLength(0);
    expect(
      trainFurnitureMatcher([p]).match({
        ...emptyPreferences,
        material: "polyester",
      }).matches,
    ).toHaveLength(1);
  });
  it("handles negative product capabilities and whole-word Filipino colours", () => {
    expect(featureTerms("sofa without storage")).not.toContain("storage");
    expect(normalize("popular sofa, kulay abo")).toBe("popular sofa grey");
  });
  it("requires clarification for unsupported, empty or contradictory model output", () => {
    for (const input of [
      {},
      { colors: ["navy"] },
      { colors: ["black"], excludedColors: ["black"] },
      { type: "Sofa", budget: -10 },
    ])
      expect(validateIntent(input).clarification).not.toBe("");
  });
  it("does not return zero-relevance sofas for blue velvet", () => {
    const p = piece();
    expect(
      trainFurnitureMatcher([p], [visual(p)]).match({
        ...emptyPreferences,
        finish: "blue velvet",
      }).matches,
    ).toHaveLength(0);
  });
  it("uses current photo colours but labels their provenance", () => {
    const p = piece();
    const r = trainFurnitureMatcher([p], [visual(p)]).match({
      ...emptyPreferences,
      color: "grey",
    });
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].reasons.join()).toContain("observed in product photos");
  });
  it("ignores old-photo and uncertain observations", () => {
    const p = piece();
    for (const v of [
      visual(p, { image_key: "old" }),
      visual(p, { clarity: "uncertain" }),
      visual(p, { version: 1 }),
    ])
      expect(
        trainFurnitureMatcher([p], [v]).match({
          ...emptyPreferences,
          color: "grey",
        }).matches,
      ).toHaveLength(0);
  });
  it("verified colour overrides the image inference", () => {
    const p = piece({ color: "White" });
    const model = trainFurnitureMatcher([p], [visual(p)]);
    expect(
      model.match({ ...emptyPreferences, color: "grey" }).matches,
    ).toHaveLength(0);
    expect(
      model.match({ ...emptyPreferences, color: "white" }).matches,
    ).toHaveLength(1);
  });
  it("excludes unknown colours when a customer says not black", () => {
    const p = piece();
    const intent = { ...blankIntent(), excludedColors: ["black"] };
    expect(
      trainFurnitureMatcher([p]).match({ ...emptyPreferences, intent }).matches,
    ).toHaveLength(0);
    expect(
      trainFurnitureMatcher([p], [visual(p)]).match({
        ...emptyPreferences,
        intent,
      }).matches,
    ).toHaveLength(1);
  });
  it("honours an interpreted budget, and a stricter manual limit", () => {
    const model = trainFurnitureMatcher([piece()]);
    const intent = { ...blankIntent(), budget: 9000 };
    expect(
      model.match({ ...emptyPreferences, budget: 20000, intent }).matches,
    ).toHaveLength(0);
    expect(
      model.match({
        ...emptyPreferences,
        budget: 8000,
        intent: { ...intent, budget: 11000 },
      }).matches,
    ).toHaveLength(0);
  });
  it("requires requested features rather than only ranking them", () => {
    const a = piece(),
      b = piece({ id: "storage", description: "Under-seat storage drawers" });
    const result = trainFurnitureMatcher([a, b]).match({
      ...emptyPreferences,
      intent: { ...blankIntent(), features: ["storage"] },
    });
    expect(result.matches.map((m) => m.product.id)).toEqual(["storage"]);
  });
  it("does not infer genuine leather from an image or faux leather", () => {
    const p = piece({ material: "Faux leather" });
    expect(materialTerms(p.material!)).not.toContain("leather");
    expect(
      trainFurnitureMatcher(
        [p],
        [visual(p, { appearance: ["leather look"] })],
      ).match({ ...emptyPreferences, material: "leather" }).matches,
    ).toHaveLength(0);
  });
  it("does not turn a metal sofa frame into leather upholstery", () => {
    expect(
      productAttributes(
        piece({
          material:
            '[{"type":"Frame","description":"Steel"},{"type":"Cover","description":"Polyester"}]',
        }),
      ).materials,
    ).not.toContain("leather");
  });
  it("uses overall bed length but never mattress length as depth", () => {
    const p = piece({
      subcategory: "Queen Size Bed",
      dimensions:
        '[{"label":"Length","value":"211","unit":"cm"},{"label":"Mattress length","value":"200","unit":"cm"}]',
    });
    expect(measurementCm(p, "depth")).toBe(211);
    expect(
      measurementCm(
        {
          ...p,
          dimensions: '[{"label":"Mattress length","value":"200","unit":"cm"}]',
        },
        "depth",
      ),
    ).toBeNull();
  });
  it("uses a round product diameter for both footprint axes", () => {
    const p = piece({ dimensions: "Diameter: 80 cm" });
    expect(measurementCm(p, "width")).toBe(80);
    expect(measurementCm(p, "depth")).toBe(80);
  });
  it("supports strict height and subtype requirements", () => {
    const model = trainFurnitureMatcher([piece()]);
    expect(
      model.match({ ...emptyPreferences, height: 85 }).matches,
    ).toHaveLength(0);
    expect(
      model.match({ ...emptyPreferences, subtype: "Recliner Sofa" }).matches,
    ).toHaveLength(0);
  });
  it("does not relax type conflicts or clarification requests", () => {
    const model = trainFurnitureMatcher([piece()]);
    expect(
      model.match({
        ...emptyPreferences,
        type: "Sofa",
        intent: { ...blankIntent(), type: "Bed" },
      }).error,
    ).toContain("conflicts");
    expect(
      model.match({
        ...emptyPreferences,
        intent: { ...blankIntent(), clarification: "Which size?" },
      }).matches,
    ).toHaveLength(0);
  });
  it("clamps unsupported model values and rejects unsafe numeric limits", () => {
    const result = validateIntent({
      colors: ["grey", "bogus"],
      budget: Infinity,
      type: "anything",
    });
    expect(result.colors).toEqual(["grey"]);
    expect(result.budget).toBeNull();
    expect(result.type).toBe("");
  });
});
