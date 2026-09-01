import { describe, expect, it } from "vitest";
import {
  readProductAvailabilityChange,
  removeUnavailableProduct,
} from "./product-availability";

describe("product availability updates", () => {
  const products = [{ id: "chair" }, { id: "table" }];

  it("reads the small public realtime payload", () => {
    expect(
      readProductAvailabilityChange({
        product_id: "chair",
        available: false,
        updated_at: "2026-08-25T11:30:00.000Z",
      }),
    ).toEqual({
      productId: "chair",
      available: false,
      updatedAt: "2026-08-25T11:30:00.000Z",
    });
  });

  it("removes a hidden product without downloading the catalog again", () => {
    expect(
      removeUnavailableProduct(products, {
        productId: "chair",
        available: false,
        updatedAt: null,
      }),
    ).toEqual([{ id: "table" }]);
  });

  it("does not remove products for activation or malformed events", () => {
    expect(
      removeUnavailableProduct(products, {
        productId: "chair",
        available: true,
        updatedAt: null,
      }),
    ).toBe(products);
    expect(readProductAvailabilityChange({ product_id: "chair" })).toBeNull();
  });
});
