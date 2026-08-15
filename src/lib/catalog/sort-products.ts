import type { Product } from "@/app/core";

export type ProductSort =
  | "featured"
  | "price-low"
  | "price-high"
  | "rating"
  | "name-asc"
  | "name-desc"
  | "newest"
  | "popular";

export function sortProducts(products: Product[], sort: ProductSort) {
  return [...products].sort((a, b) => {
    if (sort === "price-low") return a.price - b.price;
    if (sort === "price-high") return b.price - a.price;
    if (sort === "rating") return Number(b.rating) - Number(a.rating);
    if (sort === "name-asc") return a.name.localeCompare(b.name);
    if (sort === "name-desc") return b.name.localeCompare(a.name);
    if (sort === "newest") {
      return Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "");
    }
    if (sort === "popular") {
      return b.reviews - a.reviews || Number(b.rating) - Number(a.rating);
    }
    return 0;
  });
}
