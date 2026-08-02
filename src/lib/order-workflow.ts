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
