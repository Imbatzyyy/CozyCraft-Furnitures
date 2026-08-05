import { describe, expect, it } from "vitest";
import { filterByPriceRange, STOREFRONT_MAX_PRICE } from "./price-range";

const products = [
  { id: "one", price: 10_000 },
  { id: "two", price: 50_000 },
  { id: "three", price: STOREFRONT_MAX_PRICE },
  { id: "four", price: 600_000 },
];

describe("filterByPriceRange", () => {
  it("includes both selected price boundaries", () => {
    expect(filterByPriceRange(products, 50_000, 500_000).map((item) => item.id)).toEqual([
      "two",
      "three",
    ]);
  });

  it("caps the storefront filter at 500,000 pesos", () => {
    expect(filterByPriceRange(products, 0, 900_000).map((item) => item.id)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });
});
