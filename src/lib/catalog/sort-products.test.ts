import { describe, expect, it } from "vitest";
import type { Product } from "@/app/core";
import { sortProducts, type ProductSort } from "@/lib/catalog/sort-products";

const product = (
  id: string,
  name: string,
  price: number,
  rating: number,
  reviews: number,
  createdAt: string,
) => ({ id, name, price, rating, reviews, createdAt }) as unknown as Product;

const products = [
  product("a", "Tala Chair", 12_000, 4.6, 18, "2026-07-01T00:00:00Z"),
  product("b", "Amihan Sofa", 45_000, 4.9, 7, "2026-08-01T00:00:00Z"),
  product("c", "Yakal Table", 28_000, 4.2, 31, "2026-06-01T00:00:00Z"),
];

describe("sortProducts", () => {
  it.each<[ProductSort, string[]]>([
    ["price-low", ["a", "c", "b"]],
    ["price-high", ["b", "c", "a"]],
    ["rating", ["b", "a", "c"]],
    ["name-asc", ["b", "a", "c"]],
    ["name-desc", ["c", "a", "b"]],
    ["newest", ["b", "a", "c"]],
    ["popular", ["c", "a", "b"]],
  ])("sorts %s without mutating the source", (sort, expected) => {
    expect(sortProducts(products, sort).map((item) => item.id)).toEqual(expected);
    expect(products.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
