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

export function isReturnWindowOpen(
  deliveredAt: string | null | undefined,
  now = new Date(),
  windowDays = 30,
) {
  if (!deliveredAt) return false;
  const delivered = new Date(deliveredAt);
  if (Number.isNaN(delivered.getTime()) || delivered > now) return false;
  return now.getTime() - delivered.getTime() <= windowDays * 86_400_000;
}

export function isCancellationWindowOpen(
  createdAt: string | null | undefined,
  now = new Date(),
  windowHours = 24,
) {
  if (!createdAt || windowHours <= 0) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime()) || created > now) return false;
  return now.getTime() - created.getTime() <= windowHours * 3_600_000;
}
