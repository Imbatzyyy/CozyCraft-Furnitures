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

export type StockBadge = { label: string; tone: "warning" | "muted" };

/**
 * Customer-facing scarcity badge: only shown when it helps a decision.
 * Plentiful stock stays quiet instead of printing large exact counts.
 */
export function stockBadge(
  stockQuantity: number | undefined,
  stock?: string,
  lowStockLimit = 8,
): StockBadge | null {
  if (typeof stockQuantity !== "number" || !Number.isFinite(stockQuantity)) {
    return stock === "Out of stock" ? { label: "Sold out", tone: "muted" } : null;
  }
  const available = Math.max(0, Math.trunc(stockQuantity));
  if (available === 0) return { label: "Sold out", tone: "muted" };
  if (available <= lowStockLimit || stock === "Low stock") {
    return { label: available === 1 ? "Last piece" : `Only ${available} left`, tone: "warning" };
  }
  return null;
}

/** Sentence used on product pages and quick view. */
export function friendlyAvailability(
  stockQuantity: number | undefined,
  stock?: string,
  lowStockLimit = 8,
) {
  if (typeof stockQuantity !== "number" || !Number.isFinite(stockQuantity)) {
    return stock === "Out of stock" ? "Sold out" : "Availability confirmed at checkout";
  }
  const available = Math.max(0, Math.trunc(stockQuantity));
  if (available === 0) return "Sold out";
  if (available <= lowStockLimit || stock === "Low stock") {
    return available === 1 ? "Only 1 left in stock" : `Only ${available} left in stock`;
  }
  return "In stock, ready to deliver";
}
