export type CheckoutLine = {
  id: string;
  quantity: number;
};

export function selectCheckoutLines<T extends CheckoutLine>(
  cart: T[],
  productIds?: string[],
) {
  if (!productIds?.length) return { selected: cart, remaining: [] as T[] };
  const selectedIds = new Set(productIds);
  return {
    selected: cart.filter((item) => selectedIds.has(item.id)),
    remaining: cart.filter((item) => !selectedIds.has(item.id)),
  };
}

export function checkoutSignature(lines: CheckoutLine[]) {
  return lines
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join("|");
}

export function clampCartQuantity(requested: number, availableStock: number) {
  if (!Number.isFinite(requested) || !Number.isFinite(availableStock)) return 0;
  return Math.max(0, Math.min(Math.trunc(requested), Math.max(0, Math.trunc(availableStock))));
}

/**
 * A successful COD transaction removes the purchased cart rows on the server.
 * Realtime can deliver that cart change before the checkout request finishes
 * its final UI work, so the processing screen must take precedence over the
 * empty-cart screen until an order confirmation is ready.
 */
export function isCodOrderPlacementInFlight(
  placing: boolean,
  paymentMethod: string,
  completedOrderId?: string | null,
) {
  return placing && paymentMethod === "cod" && !completedOrderId;
}
