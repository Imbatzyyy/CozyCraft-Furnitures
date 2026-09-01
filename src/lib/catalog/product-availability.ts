export type ProductAvailabilityChange = {
  productId: string;
  available: boolean;
  updatedAt: string | null;
};

export function readProductAvailabilityChange(
  value: unknown,
): ProductAvailabilityChange | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.product_id !== "string" ||
    row.product_id.trim().length === 0 ||
    typeof row.available !== "boolean"
  ) {
    return null;
  }

  return {
    productId: row.product_id,
    available: row.available,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export function removeUnavailableProduct<T extends { id: string }>(
  products: T[],
  change: ProductAvailabilityChange,
): T[] {
  if (change.available || !products.some((product) => product.id === change.productId)) {
    return products;
  }
  return products.filter((product) => product.id !== change.productId);
}
