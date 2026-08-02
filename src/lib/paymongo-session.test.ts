import { describe, expect, it } from "vitest";
import {
  findPaidProviderPayment,
  providerSessionLivemode,
} from "../../supabase/functions/_shared/paymongo-session";

describe("PayMongo session parsing", () => {
  it("finds a settled payment", () => {
    expect(findPaidProviderPayment({ data: { attributes: { payments: [
      { id: "pay_123", attributes: { status: "paid" } },
    ] } } })).toEqual({ id: "pay_123" });
  });

  it("supports nested provider payment objects", () => {
    expect(findPaidProviderPayment({ data: { attributes: { payments: [
      { data: { id: "pay_nested", attributes: { status: "paid" } } },
    ] } } })).toEqual({ id: "pay_nested" });
  });

  it("does not treat pending or malformed data as paid", () => {
    expect(findPaidProviderPayment({ data: { attributes: { payments: [
      { id: "pay_pending", attributes: { status: "pending" } },
    ] } } })).toBeNull();
    expect(findPaidProviderPayment(null)).toBeNull();
  });

  it("reads livemode only from an explicit boolean", () => {
    expect(providerSessionLivemode({ data: { attributes: { livemode: true } } })).toBe(true);
    expect(providerSessionLivemode({ data: { attributes: { livemode: "true" } } })).toBe(false);
  });
});
