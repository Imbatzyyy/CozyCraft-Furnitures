import type { DbOrder, DbSupportTicket } from "@/services/supabase/client";
import { countAdminOrderView } from "./order-desk";

export type ClientErrorSummary = {
  id: string | number;
  message: string;
  path: string | null;
  created_at: string;
};

type HealthProduct = {
  stockQuantity?: number;
  status?: "draft" | "active" | "inactive";
};

export type OperationsHealthSnapshot = {
  overall: "healthy" | "attention" | "degraded";
  liveOrdersConnected: boolean;
  failedPayments: number;
  failedRefunds: number;
  overdueFulfillment: number;
  priorityTickets: number;
  outOfStockProducts: number;
  recentClientErrors: number;
};

export function buildOperationsHealthSnapshot(input: {
  orders: readonly DbOrder[];
  products: readonly HealthProduct[];
  tickets: readonly DbSupportTicket[];
  clientErrors: readonly ClientErrorSummary[];
  liveOrdersConnected: boolean;
  now?: Date;
}): OperationsHealthSnapshot {
  const now = input.now ?? new Date();
  const overdueCutoff = now.getTime() - 48 * 60 * 60 * 1000;
  const failedPayments = input.orders.filter((order) => order.payment_status === "failed").length;
  const failedRefunds = countAdminOrderView(input.orders, "refund_attention");
  const overdueFulfillment = input.orders.filter(
    (order) =>
      ["pending", "processing", "packed"].includes(order.status) &&
      new Date(order.created_at).getTime() < overdueCutoff,
  ).length;
  const priorityTickets = input.tickets.filter(
    (ticket) =>
      !["resolved", "closed"].includes(ticket.status) &&
      ["high", "urgent"].includes(ticket.priority),
  ).length;
  const outOfStockProducts = input.products.filter(
    (product) => product.status !== "inactive" && (product.stockQuantity ?? 0) === 0,
  ).length;
  const recentClientErrors = input.clientErrors.length;
  const degraded = !input.liveOrdersConnected || failedRefunds > 0;
  const needsAttention =
    failedPayments > 0 ||
    overdueFulfillment > 0 ||
    priorityTickets > 0 ||
    outOfStockProducts > 0 ||
    recentClientErrors > 0;

  return {
    overall: degraded ? "degraded" : needsAttention ? "attention" : "healthy",
    liveOrdersConnected: input.liveOrdersConnected,
    failedPayments,
    failedRefunds,
    overdueFulfillment,
    priorityTickets,
    outOfStockProducts,
    recentClientErrors,
  };
}
