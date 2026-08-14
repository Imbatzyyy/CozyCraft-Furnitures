import { describe, expect, it } from "vitest";
import {
  catalogValuesMatch,
  matchesCatalogSearch,
  matchesCatalogSubcategory,
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
});
