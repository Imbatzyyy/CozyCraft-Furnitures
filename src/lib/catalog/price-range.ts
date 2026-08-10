export const STOREFRONT_MAX_PRICE = 500_000;

export function filterByPriceRange<T extends { price: number }>(
  products: T[],
  minimum: number,
  maximum: number,
) {
  const safeMinimum = Math.max(0, Math.min(minimum, STOREFRONT_MAX_PRICE));
  const safeMaximum = Math.max(
    safeMinimum,
    Math.min(maximum, STOREFRONT_MAX_PRICE),
  );

  return products.filter(
    (product) => product.price >= safeMinimum && product.price <= safeMaximum,
  );
}
