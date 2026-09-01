import { describe, expect, it } from "vitest";
import type { DbOrder, DbSupportTicket } from "@/services/supabase/client";
import { buildAdminAttentionItems } from "./operations-attention";

const baseOrder = {
  id: "order-1",
  order_number: "CC-00001",
  user_id: "customer-1",
  status: "pending",
  payment_method: "cod",
  payment_status: "pending",
  subtotal: 1000,
  delivery_fee: 0,
  total: 1000,
  shipping_address: {},
  created_at: "2026-09-01T00:00:00.000Z",
  order_items: [],
  order_status_history: [],
} as DbOrder;

const urgentTicket = {
  id: "ticket-1",
  ticket_number: "T-1",
  user_id: "customer-1",
  order_id: null,
  subject: "Delivery concern",
  message: "Please help",
  status: "open",
  category: "delivery",
  priority: "urgent",
  assigned_to: null,
  attachment_paths: [],
  admin_reply: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
} as DbSupportTicket;

describe("admin action center", () => {
  it("shows role-safe operational queues to staff", () => {
    const items = buildAdminAttentionItems({
      orders: [baseOrder],
      products: [{ status: "active", stockQuantity: 2 }],
      tickets: [urgentTicket],
      role: "Staff",
    });
    expect(items.map((item) => item.id)).toEqual([
      "fulfillment",
      "inventory",
      "support",
    ]);
    expect(items.find((item) => item.id === "fulfillment")?.count).toBe(1);
  });

  it("adds protected cancellation and refund queues for administrators", () => {
    const items = buildAdminAttentionItems({
      orders: [
        { ...baseOrder, cancellation_status: "pending" },
        { ...baseOrder, id: "order-2", refund_status: "failed" },
      ],
      products: [],
      tickets: [],
      role: "Administrator",
    });
    expect(items.find((item) => item.id === "cancellations")?.count).toBe(1);
    expect(items.find((item) => item.id === "refunds")?.count).toBe(1);
  });
});
