import { describe, expect, it } from "vitest";
import { allowedReturnStatuses, canTransitionReturn } from "./return-workflow";

describe("return workflow", () => {
  it("requires review and receipt before refund processing", () => {
    expect(canTransitionReturn("requested", "approved")).toBe(true);
    expect(canTransitionReturn("approved", "item_received")).toBe(true);
    expect(canTransitionReturn("item_received", "refund_processing")).toBe(true);
    expect(canTransitionReturn("refund_processing", "refunded")).toBe(true);
  });

  it("prevents skipped or reversed stages", () => {
    expect(canTransitionReturn("requested", "refunded")).toBe(false);
    expect(canTransitionReturn("item_received", "approved")).toBe(false);
    expect(canTransitionReturn("refunded", "item_received")).toBe(false);
  });

  it("makes closed returns terminal", () => {
    expect(allowedReturnStatuses("closed")).toEqual(["closed"]);
  });
});
