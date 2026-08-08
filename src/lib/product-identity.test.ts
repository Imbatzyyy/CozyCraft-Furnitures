import { describe, expect, it } from "vitest";
import {
  createProductId,
  normalizeProductIdentityPart,
  productsShareCatalogIdentity,
} from "./product-identity";

describe("product catalog identity", () => {
  it("normalizes casing and repeated whitespace", () => {
    expect(normalizeProductIdentityPart("  TONSTAD   Tall ")).toBe(
      "tonstad tall",
    );
  });

  it("blocks the same name only inside the same category and subcategory", () => {
    const nightstand = {
      name: "TONSTAD",
      category: "Bedroom",
      subcategory: "Wooden Nightstand",
    };
    expect(
      productsShareCatalogIdentity(nightstand, {
        name: " tonstad ",
        category: "bedroom",
        subcategory: "Wooden   Nightstand",
      }),
    ).toBe(true);
    expect(
      productsShareCatalogIdentity(nightstand, {
        ...nightstand,
        category: "Living room",
        subcategory: "Wooden TV Stand",
      }),
    ).toBe(false);
    expect(
      productsShareCatalogIdentity(nightstand, {
        ...nightstand,
        subcategory: "Modern Nightstand",
      }),
    ).toBe(false);
  });

  it("creates collision-safe ids that include the catalog placement", () => {
    expect(
      createProductId(
        {
          name: "TONSTAD",
          category: "Bedroom",
          subcategory: "Wooden Nightstand",
        },
        "a1b2c3d4-rest",
      ),
    ).toBe("tonstad-bedroom-wooden-nightstand-a1b2c3d4");
  });
});

