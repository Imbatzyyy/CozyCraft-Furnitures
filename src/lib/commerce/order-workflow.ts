export type FulfillmentStatus =
  | "pending"
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

const transitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function allowedFulfillmentStatuses(current: FulfillmentStatus) {
  return [current, ...transitions[current]];
}

export function canTransitionFulfillment(
  current: FulfillmentStatus,
  next: FulfillmentStatus,
) {
  return current === next || transitions[current].includes(next);
}

type PaymentRecord = {
  status: string;
  updated_at: string;
};

const settledPaymentStatuses = new Set(["paid", "refunded"]);

/**
 * Checkout retries can create more than one provider transaction for an order.
 * Prefer the newest settled record, then fall back to the newest attempt.
 */
export function currentPaymentTransaction<T extends PaymentRecord>(
  transactions: T[] | null | undefined,
) {
  if (!transactions?.length) return undefined;
  return [...transactions].sort((left, right) => {
    const settledDifference =
      Number(settledPaymentStatuses.has(right.status)) -
      Number(settledPaymentStatuses.has(left.status));
    if (settledDifference) return settledDifference;
    return Date.parse(right.updated_at) - Date.parse(left.updated_at);
  })[0];
}
