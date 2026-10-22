export const CHECKOUT_LIMITS = { perProduct: 10, products: 10, pieces: 20, total: 500_000 } as const;
export function checkoutQuantityError(lines: Array<{ id: string; quantity: number }>): string {
  const combined = new Map<string, number>();
  for (const line of lines) {
    if (!line.id || !Number.isSafeInteger(line.quantity) || line.quantity < 1) return "Choose a valid whole-number quantity for each product.";
    combined.set(line.id, (combined.get(line.id) ?? 0) + line.quantity);
  }
  if (combined.size > CHECKOUT_LIMITS.products) return "Choose at most 10 different products per checkout. Contact CozyCraft for a bulk order.";
  if ([...combined.values()].some(n => n > CHECKOUT_LIMITS.perProduct)) return "Choose at most 10 pieces of each product. Contact CozyCraft for a bulk order.";
  if ([...combined.values()].reduce((a, b) => a + b, 0) > CHECKOUT_LIMITS.pieces) return "Choose at most 20 pieces in one checkout. Contact CozyCraft for a bulk order.";
  return "";
}
export const cartProductCount = (lines: Array<{ id: string; quantity: number }>) => new Set(lines.filter(x => x.quantity > 0).map(x => x.id)).size;
