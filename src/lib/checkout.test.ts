import { describe, expect, it } from "vitest";
import { checkoutSignature, clampCartQuantity, selectCheckoutLines } from "./checkout";

const cart = [
  { id: "chair", quantity: 2, selectedForCheckout: true },
  { id: "table", quantity: 1, selectedForCheckout: false },
];

describe("checkout invariants", () => {
  it("keeps unchecked products in the bag", () => {
    const result = selectCheckoutLines(cart, ["chair"]);
    expect(result.selected.map((item) => item.id)).toEqual(["chair"]);
    expect(result.remaining).toEqual([cart[1]]);
  });

  it("creates the same idempotency signature regardless of cart order", () => {
    expect(checkoutSignature(cart)).toBe(checkoutSignature([...cart].reverse()));
    expect(checkoutSignature(cart)).toBe("chair:2|table:1");
  });

  it("never allows quantities above live stock or below zero", () => {
    expect(clampCartQuantity(9, 3)).toBe(3);
    expect(clampCartQuantity(-2, 3)).toBe(0);
    expect(clampCartQuantity(2, 0)).toBe(0);
  });
});
