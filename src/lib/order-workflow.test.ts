import { describe, expect, it } from "vitest";
import {
  allowedFulfillmentStatuses,
  canTransitionFulfillment,
} from "./order-workflow";

describe("fulfillment state machine", () => {
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
});
