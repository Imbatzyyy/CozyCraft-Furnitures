import { describe, expect, it } from "vitest";
import { orderRealtimeTarget } from "./realtime-orders";

describe("order Realtime targeting", () => {
  it("targets a newly inserted order and announces it", () => {
    expect(
      orderRealtimeTarget({
        eventType: "INSERT",
        table: "orders",
        new: { id: "order-1", user_id: "customer-1" },
        old: {},
      }),
    ).toEqual({
      orderId: "order-1",
      removeOrder: false,
      announceNewOrder: true,
    });
  });

  it("targets a child row through its order_id", () => {
    expect(
      orderRealtimeTarget({
        eventType: "UPDATE",
        table: "payment_transactions",
        new: { id: "payment-1", order_id: "order-2" },
        old: {},
      }),
    ).toEqual({
      orderId: "order-2",
      removeOrder: false,
      announceNewOrder: false,
    });
  });

  it("removes only a deleted top-level order", () => {
    expect(
      orderRealtimeTarget({
        eventType: "DELETE",
        table: "orders",
        new: {},
        old: { id: "order-3" },
      }),
    ).toEqual({
      orderId: "order-3",
      removeOrder: true,
      announceNewOrder: false,
    });
  });

  it("does not mistake a deleted child id for an order id", () => {
    expect(
      orderRealtimeTarget({
        eventType: "DELETE",
        table: "order_items",
        new: {},
        old: { id: "item-1" },
      }),
    ).toEqual({
      orderId: null,
      removeOrder: false,
      announceNewOrder: false,
    });
  });
});
