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

describe("customer stock messaging", () => {
  it("keeps plentiful stock quiet and highlights scarcity", async () => {
    const { stockBadge, friendlyAvailability } = await import("./stock-availability");
    expect(stockBadge(545, "In stock")).toBeNull();
    expect(stockBadge(2, "Low stock")).toEqual({ label: "Only 2 left", tone: "warning" });
    expect(stockBadge(1)).toEqual({ label: "Last piece", tone: "warning" });
    expect(stockBadge(0)).toEqual({ label: "Sold out", tone: "muted" });
    expect(stockBadge(undefined, "Out of stock")).toEqual({ label: "Sold out", tone: "muted" });
    expect(friendlyAvailability(545)).toBe("In stock, ready to deliver");
    expect(friendlyAvailability(3)).toBe("Only 3 left in stock");
    expect(friendlyAvailability(0)).toBe("Sold out");
    expect(friendlyAvailability(undefined)).toBe("Availability confirmed at checkout");
  });
});
