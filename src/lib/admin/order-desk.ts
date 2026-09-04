import type { DbOrder } from "@/services/supabase/client";

export const ADMIN_ORDER_VIEW_OPTIONS = [
  { id: "all", label: "All orders" },
  { id: "needs_fulfillment", label: "Ready to fulfill" },
  { id: "awaiting_payment", label: "Awaiting payment" },
  { id: "cancellation_requests", label: "Cancellation requests" },
  { id: "returns", label: "Returns" },
  { id: "refund_attention", label: "Refund attention" },
  { id: "delivered", label: "Delivered" },
] as const;

export type AdminOrderView = (typeof ADMIN_ORDER_VIEW_OPTIONS)[number]["id"];
export type AdminOrderDateRange = "all" | "today" | "last_7_days" | "last_30_days";
export type AdminOrderSort = "newest" | "oldest" | "highest_total" | "longest_waiting";

export type AdminOrderDeskFilters = {
  query: string;
  view: AdminOrderView;
  status: "all" | DbOrder["status"];
  paymentStatus: "all" | DbOrder["payment_status"];
  paymentMethod: "all" | string;
  dateRange: AdminOrderDateRange;
  sort: AdminOrderSort;
};

export const DEFAULT_ADMIN_ORDER_FILTERS: AdminOrderDeskFilters = {
  query: "",
  view: "all",
  status: "all",
  paymentStatus: "all",
  paymentMethod: "all",
  dateRange: "today",
  sort: "oldest",
};

export function adminOrderSelectionParams(
  current: URLSearchParams,
  orderId: string,
  dateRange: AdminOrderDateRange,
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("order", orderId);
  next.set("range", dateRange);
  return next;
}

const terminalStatuses = new Set<DbOrder["status"]>(["delivered", "cancelled"]);

export function isOrderReadyForFulfillment(order: DbOrder): boolean {
  return (
    !terminalStatuses.has(order.status) &&
    order.cancellation_status !== "pending" &&
    (order.payment_method.toLowerCase() === "cod" || order.payment_status === "paid")
  );
}

export function orderMatchesSavedView(
  order: DbOrder,
  view: AdminOrderView,
  returnOrderIds: ReadonlySet<string> = new Set(),
): boolean {
  switch (view) {
    case "needs_fulfillment":
      return isOrderReadyForFulfillment(order);
    case "awaiting_payment":
      return (
        order.status === "pending" &&
        order.payment_method.toLowerCase() !== "cod" &&
        order.payment_status === "pending"
      );
    case "cancellation_requests":
      return order.cancellation_status === "pending";
    case "returns":
      return returnOrderIds.has(order.id);
    case "refund_attention":
      return order.refund_status === "failed";
    case "delivered":
      return order.status === "delivered";
    case "all":
    default:
      return true;
  }
}

function orderSearchText(order: DbOrder): string {
  return [
    order.order_number,
    order.id,
    order.status,
    order.payment_status,
    order.payment_method,
    order.shipping_address.name,
    order.shipping_address.email,
    order.shipping_address.mobile,
    order.profiles?.full_name,
    order.profiles?.email,
    order.profiles?.phone,
    ...order.order_items.map((item) => item.product_name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

const manilaDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function manilaDayNumber(value: Date): number {
  const parts = Object.fromEntries(
    manilaDateParts
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000,
  );
}

function orderMatchesDateRange(
  createdAt: string,
  range: AdminOrderDateRange,
  now: Date,
): boolean {
  if (range === "all") return true;
  const ageInDays = manilaDayNumber(now) - manilaDayNumber(new Date(createdAt));
  if (range === "today") return ageInDays === 0;
  if (range === "last_7_days") return ageInDays >= 0 && ageInDays <= 6;
  return ageInDays >= 0 && ageInDays <= 29;
}

export function filterAdminOrders(
  orders: readonly DbOrder[],
  filters: AdminOrderDeskFilters,
  options: {
    returnOrderIds?: ReadonlySet<string>;
    now?: Date;
  } = {},
): DbOrder[] {
  const term = filters.query.trim().toLocaleLowerCase();
  const now = options.now ?? new Date();
  const returnOrderIds = options.returnOrderIds ?? new Set<string>();

  const filtered = orders.filter((order) => {
    if (term && !orderSearchText(order).includes(term)) return false;
    if (!orderMatchesSavedView(order, filters.view, returnOrderIds)) return false;
    if (filters.status !== "all" && order.status !== filters.status) return false;
    if (filters.paymentStatus !== "all" && order.payment_status !== filters.paymentStatus) return false;
    if (
      filters.paymentMethod !== "all" &&
      order.payment_method.toLocaleLowerCase() !== filters.paymentMethod.toLocaleLowerCase()
    ) {
      return false;
    }
    return orderMatchesDateRange(order.created_at, filters.dateRange, now);
  });

  return filtered.sort((left, right) => {
    if (filters.sort === "oldest" || filters.sort === "longest_waiting") {
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    }
    if (filters.sort === "highest_total") {
      return Number(right.total) - Number(left.total);
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export function countAdminOrderView(
  orders: readonly DbOrder[],
  view: AdminOrderView,
  returnOrderIds: ReadonlySet<string> = new Set(),
): number {
  return orders.filter((order) => orderMatchesSavedView(order, view, returnOrderIds)).length;
}

export function hasActiveAdminOrderFilters(filters: AdminOrderDeskFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.view !== "all" ||
    filters.status !== "all" ||
    filters.paymentStatus !== "all" ||
    filters.paymentMethod !== "all" ||
    filters.dateRange !== DEFAULT_ADMIN_ORDER_FILTERS.dateRange ||
    filters.sort !== DEFAULT_ADMIN_ORDER_FILTERS.sort
  );
}
