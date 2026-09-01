import { describe, expect, it } from "vitest";
import {
  catalogValuesMatch,
  matchesCatalogSearch,
  matchesCatalogSubcategory,
  rankCatalogSearch,
  scoreCatalogSearch,
} from "./discovery";

const champagne = {
  id: "champagne",
  name: "CHAMPAGNE",
  category: " Dining room ",
  subcategory: "Luxury  Velvet Dining Chairs",
  color: "Champagne beige",
  material: "Velvet",
  description: "An upholstered dining chair",
};

describe("catalog discovery", () => {
  it("matches categories despite whitespace and casing differences", () => {
    expect(catalogValuesMatch(champagne.category, "dining ROOM")).toBe(true);
  });

  it("matches normalized database subcategories", () => {
    expect(
      matchesCatalogSubcategory(champagne, "Luxury Velvet Dining Chairs"),
    ).toBe(true);
  });

  it("searches all important product fields", () => {
    expect(matchesCatalogSearch(champagne, "champagne")).toBe(true);
    expect(matchesCatalogSearch(champagne, "velvet dining")).toBe(true);
    expect(matchesCatalogSearch(champagne, "upholstered")).toBe(true);
    expect(matchesCatalogSearch(champagne, "sofa|velvet")).toBe(true);
  });

  it("ranks actual product types above incidental description mentions", () => {
    const sofa = {
      id: "sofa",
      name: "HEMLINGBY",
      category: "Living room",
      subcategory: "2-Seater Fabric Sofa",
      description: "A compact seat for two.",
    };
    const nightstand = {
      id: "nightstand",
      name: "KNARREVIK",
      category: "Bedroom",
      subcategory: "Metal Nightstand",
      description: "A useful table beside a sofa or bed.",
    };

    expect(scoreCatalogSearch(sofa, "sofa")).toBeGreaterThan(
      scoreCatalogSearch(nightstand, "sofa"),
    );
    expect(rankCatalogSearch([nightstand, sofa], "sofa")).toEqual([
      sofa,
      nightstand,
    ]);
  });

  it("keeps stable catalog order when products have the same search score", () => {
    const first = { ...champagne, id: "first", name: "Velvet One" };
    const second = { ...champagne, id: "second", name: "Velvet Two" };
    expect(rankCatalogSearch([first, second], "velvet")).toEqual([
      first,
      second,
    ]);
  });
});
