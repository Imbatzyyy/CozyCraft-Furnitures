import { describe, expect, it } from "vitest";
import {
  allowedFulfillmentStatuses,
  canTransitionFulfillment,
  currentPaymentTransaction,
  fulfillmentPaymentBlocked,
} from "./order-workflow";

describe("fulfillment state machine", () => {
  it("blocks unpaid online fulfillment but not COD", () => {
    for (const payment_method of ["card", "gcash"]) {
      for (const payment_status of ["pending", "failed", "refunded"]) expect(fulfillmentPaymentBlocked({ payment_method, payment_status })).toBe(true);
      expect(fulfillmentPaymentBlocked({ payment_method, payment_status: "paid" })).toBe(false);
    }
    expect(fulfillmentPaymentBlocked({ payment_method: "cod", payment_status: "pending" })).toBe(false);
  });
  it("allows only forward fulfillment progress", () => {
    expect(canTransitionFulfillment("pending", "processing")).toBe(true);
    expect(canTransitionFulfillment("processing", "packed")).toBe(true);
    expect(canTransitionFulfillment("packed", "shipped")).toBe(true);
    expect(canTransitionFulfillment("shipped", "delivered")).toBe(true);
  });

  it("prevents backward and skipped transitions", () => {
    expect(canTransitionFulfillment("delivered", "pending")).toBe(false);
    expect(canTransitionFulfillment("processing", "delivered")).toBe(false);
    expect(canTransitionFulfillment("cancelled", "processing")).toBe(false);
  });

  it("does not allow cancellation after shipment", () => {
    expect(allowedFulfillmentStatuses("shipped")).toEqual([
      "shipped",
      "delivered",
    ]);
    expect(allowedFulfillmentStatuses("delivered")).toEqual(["delivered"]);
  });

  it("uses the newest settled payment instead of a stale checkout attempt", () => {
    const transactions = [
      { id: "expired", status: "expired", updated_at: "2026-08-10T10:00:00Z" },
      { id: "paid", status: "paid", updated_at: "2026-08-10T09:59:00Z" },
      { id: "pending", status: "pending", updated_at: "2026-08-10T10:01:00Z" },
    ];

    expect(currentPaymentTransaction(transactions)?.id).toBe("paid");
  });

  it("uses the newest attempt when no payment has settled", () => {
    const transactions = [
      { id: "old", status: "failed", updated_at: "2026-08-10T09:00:00Z" },
      { id: "new", status: "pending", updated_at: "2026-08-10T10:00:00Z" },
    ];

    expect(currentPaymentTransaction(transactions)?.id).toBe("new");
  });
});
