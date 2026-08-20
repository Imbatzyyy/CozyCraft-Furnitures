export function exactStockAvailability(
  stockQuantity: number | undefined,
  fallback = "Availability unavailable",
) {
  if (typeof stockQuantity !== "number" || !Number.isFinite(stockQuantity)) {
    return fallback;
  }

  const available = Math.max(0, Math.trunc(stockQuantity));
  if (available === 0) return "Out of stock";

  return `${available.toLocaleString("en-PH")} ${available === 1 ? "piece" : "pieces"} available`;
}
