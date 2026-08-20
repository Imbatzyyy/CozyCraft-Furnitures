import { describe, expect, it } from "vitest";
import { exactStockAvailability } from "./stock-availability";

describe("exactStockAvailability", () => {
  it("shows the exact available quantity with correct grammar", () => {
    expect(exactStockAvailability(1)).toBe("1 piece available");
    expect(exactStockAvailability(18)).toBe("18 pieces available");
  });

  it("never presents negative inventory to customers", () => {
    expect(exactStockAvailability(0)).toBe("Out of stock");
    expect(exactStockAvailability(-4)).toBe("Out of stock");
  });

  it("uses the supplied fallback when a quantity is unavailable", () => {
    expect(exactStockAvailability(undefined, "In stock")).toBe("In stock");
  });
});
