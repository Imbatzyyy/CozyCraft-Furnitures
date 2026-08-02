export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "item_received"
  | "refund_processing"
  | "refunded"
  | "closed";

const transitions: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["item_received", "rejected"],
  rejected: ["closed"],
  item_received: ["refund_processing", "closed"],
  refund_processing: ["item_received", "refunded"],
  refunded: ["closed"],
  closed: [],
};

export function allowedReturnStatuses(current: ReturnStatus) {
  return [current, ...transitions[current]];
}

export function canTransitionReturn(current: ReturnStatus, next: ReturnStatus) {
  return current === next || transitions[current].includes(next);
}
