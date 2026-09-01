import type { WorkspaceRole } from "./access";
import type { DbOrder, DbSupportTicket } from "@/services/supabase/client";
import { countAdminOrderView } from "./order-desk";

type AttentionProduct = {
  stockQuantity?: number;
  status?: "draft" | "active" | "inactive";
};

export type AdminAttentionItem = {
  id: "fulfillment" | "cancellations" | "refunds" | "inventory" | "support";
  label: string;
  description: string;
  count: number;
  route: string;
  level: "neutral" | "warning" | "critical";
};

export function buildAdminAttentionItems(input: {
  orders: readonly DbOrder[];
  products: readonly AttentionProduct[];
  tickets: readonly DbSupportTicket[];
  role: WorkspaceRole;
}): AdminAttentionItem[] {
  const { orders, products, tickets, role } = input;
  const financialAccess = role === "Administrator" || role === "Super Administrator";
  const lowStock = products.filter(
    (product) => product.status !== "inactive" && (product.stockQuantity ?? 0) <= 8,
  ).length;
  const priorityTickets = tickets.filter(
    (ticket) =>
      !["resolved", "closed"].includes(ticket.status) &&
      ["high", "urgent"].includes(ticket.priority),
  ).length;

  const items: AdminAttentionItem[] = [
    {
      id: "fulfillment",
      label: "Ready to fulfill",
      description: "Paid and COD orders that can move forward now.",
      count: countAdminOrderView(orders, "needs_fulfillment"),
      route: "/admin/orders?view=needs_fulfillment",
      level: "neutral",
    },
    {
      id: "inventory",
      label: "Low-stock products",
      description: "Active catalog pieces at or below the reorder point.",
      count: lowStock,
      route: "/admin/inventory",
      level: lowStock > 0 ? "warning" : "neutral",
    },
    {
      id: "support",
      label: "Priority support",
      description: "High-priority customer concerns still open.",
      count: priorityTickets,
      route: "/admin/support",
      level: priorityTickets > 0 ? "warning" : "neutral",
    },
  ];

  if (financialAccess) {
    items.splice(1, 0,
      {
        id: "cancellations",
        label: "Cancellation requests",
        description: "Customer requests waiting for an authorized decision.",
        count: countAdminOrderView(orders, "cancellation_requests"),
        route: "/admin/orders?view=cancellation_requests",
        level: "warning",
      },
      {
        id: "refunds",
        label: "Refund failures",
        description: "Refunds that need a manual follow-up.",
        count: countAdminOrderView(orders, "refund_attention"),
        route: "/admin/orders?view=refund_attention",
        level: "critical",
      },
    );
  }

  return items;
}
