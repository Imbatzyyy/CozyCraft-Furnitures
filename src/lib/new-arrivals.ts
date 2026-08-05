export function selectNewArrivals<T extends { category: string }>(
  products: T[],
  room: string,
  limit = 12,
) {
  const normalizedRoom = room.trim().toLowerCase();
  const matchingProducts =
    normalizedRoom === "all"
      ? products
      : products.filter(
          (product) => product.category.trim().toLowerCase() === normalizedRoom,
        );

  return matchingProducts.slice(0, Math.max(0, limit));
}
