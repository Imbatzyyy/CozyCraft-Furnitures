import { describe, expect, it } from "vitest";
import type { DbOrder } from "@/services/supabase/client";
import { buildOperationsHealthSnapshot } from "./operations-health";

const order = {
  id: "order-1",
  order_number: "CC-00001",
  user_id: "customer-1",
  status: "processing",
  payment_method: "card",
  payment_status: "paid",
  subtotal: 1000,
  delivery_fee: 0,
  total: 1000,
  shipping_address: {},
  created_at: "2026-08-20T00:00:00.000Z",
  order_items: [],
  order_status_history: [],
} as DbOrder;

describe("operations health snapshot", () => {
  it("reports a clear workspace when all monitored signals are healthy", () => {
    expect(
      buildOperationsHealthSnapshot({
        orders: [],
        products: [],
        tickets: [],
        clientErrors: [],
        liveOrdersConnected: true,
        now: new Date("2026-09-01T00:00:00.000Z"),
      }).overall,
    ).toBe("healthy");
  });

  it("escalates disconnected realtime or failed refunds as degraded", () => {
    const snapshot = buildOperationsHealthSnapshot({
      orders: [{ ...order, refund_status: "failed" }],
      products: [{ status: "active", stockQuantity: 0 }],
      tickets: [],
      clientErrors: [],
      liveOrdersConnected: false,
      now: new Date("2026-09-01T00:00:00.000Z"),
    });
    expect(snapshot.overall).toBe("degraded");
    expect(snapshot.failedRefunds).toBe(1);
    expect(snapshot.overdueFulfillment).toBe(1);
    expect(snapshot.outOfStockProducts).toBe(1);
  });
});
