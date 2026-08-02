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
