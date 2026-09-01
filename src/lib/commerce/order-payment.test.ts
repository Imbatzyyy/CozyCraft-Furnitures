import { describe, expect, it } from "vitest";
import type { DbOrder } from "@/services/supabase/client";
import {
  effectiveOrderPaymentStatus,
  orderPaymentMethodLabel,
  orderPaymentReference,
} from "./order-payment";

const order = {
  id: "order-1",
  order_number: "CC-01098",
  user_id: "customer-1",
  status: "delivered",
  payment_method: "cod",
  payment_status: "pending",
  subtotal: 7_999,
  delivery_fee: 2_250,
  total: 10_249,
  shipping_address: {},
  created_at: "2026-08-24T11:03:00.000Z",
  order_items: [],
  order_status_history: [],
  payment_transactions: [],
} satisfies DbOrder;

describe("order payment presentation", () => {
  it("treats delivered cash-on-delivery orders as paid", () => {
    expect(effectiveOrderPaymentStatus(order)).toBe("paid");
  });

  it("does not settle cash-on-delivery before delivery", () => {
    expect(
      effectiveOrderPaymentStatus({ ...order, status: "shipped" }),
    ).toBe("pending");
  });

  it("creates a stable cash-on-delivery reference from the order number", () => {
    expect(orderPaymentReference(order)).toBe("COD-CC-01098");
  });

  it("survives a legacy non-array payment relation", () => {
    expect(
      orderPaymentReference({
        ...order,
        payment_method: "card",
        payment_transactions: null as unknown as DbOrder["payment_transactions"],
      }),
    ).toBe("PAY-CC-01098");
    expect(
      orderPaymentReference({
        ...order,
        payment_method: "card",
        payment_transactions: {} as DbOrder["payment_transactions"],
      }),
    ).toBe("PAY-CC-01098");
  });

  it("uses customer-friendly payment method labels", () => {
    expect(orderPaymentMethodLabel("cod")).toBe("Cash on delivery");
    expect(orderPaymentMethodLabel("gcash")).toBe("GCash");
  });
});
