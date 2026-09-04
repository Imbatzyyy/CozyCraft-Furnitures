import { describe, expect, it } from "vitest";
import {
  calculateDeliveryFee,
  defaultStoreSettings,
  isPaymentMethodAvailable,
  normalizeStoreSettings,
  validateCheckoutAmount,
} from "./store-settings";

describe("store settings", () => {
  it("merges partial database JSON with safe defaults", () => {
    const settings = normalizeStoreSettings({
      checkout_settings: { standard_delivery_fee: 250 } as never,
    });
    expect(settings.checkout_settings.standard_delivery_fee).toBe(250);
    expect(settings.checkout_settings.cod_enabled).toBe(true);
    expect(settings.fulfillment_settings.order_number_prefix).toBe("CC");
  });

  it("discards the retired review approval setting from legacy database rows", () => {
    const settings = normalizeStoreSettings({
      review_settings: {
        approval_required: true,
        minimum_length: 12,
      } as never,
    });

    expect(settings.review_settings.minimum_length).toBe(12);
    expect("approval_required" in settings.review_settings).toBe(false);
  });

  it("calculates configurable delivery fees", () => {
    const checkout = {
      ...defaultStoreSettings.checkout_settings,
      standard_delivery_fee: 350,
      free_delivery_minimum: 10_000,
    };
    expect(calculateDeliveryFee(9_999, checkout)).toBe(350);
    expect(calculateDeliveryFee(10_000, checkout)).toBe(0);
  });

  it("enforces payment availability and COD limits", () => {
    const checkout = {
      ...defaultStoreSettings.checkout_settings,
      cod_maximum_order: 20_000,
      card_enabled: false,
    };
    expect(isPaymentMethodAvailable("cod", 19_999, checkout)).toBe(true);
    expect(isPaymentMethodAvailable("cod", 20_001, checkout)).toBe(false);
    expect(isPaymentMethodAvailable("card", 1_000, checkout)).toBe(false);
  });

  it("validates minimum and maximum order amounts", () => {
    const checkout = {
      ...defaultStoreSettings.checkout_settings,
      minimum_order_amount: 500,
      maximum_order_amount: 50_000,
    };
    expect(validateCheckoutAmount(499, checkout)).toContain("minimum");
    expect(validateCheckoutAmount(50_001, checkout)).toContain("maximum");
    expect(validateCheckoutAmount(1_000, checkout)).toBe("");
  });
});
