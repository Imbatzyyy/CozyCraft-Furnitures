import { describe, expect, it } from "vitest";
import {
  deliveryAreaCodeForAddress,
  deliveryAreaForAddress,
  deliveryDateRange,
  deliveryFeeFor,
  type DeliveryServiceArea,
} from "./delivery";

const area: DeliveryServiceArea = {
  id: 1,
  area_code: "metro-manila",
  name: "Metro Manila",
  description: "NCR",
  delivery_fee: 650,
  free_delivery_minimum: 50_000,
  lead_time_min_days: 2,
  lead_time_max_days: 4,
  assembly_available: true,
  active: true,
  sort_order: 10,
};

describe("delivery estimates", () => {
  it("waives the fee at the configured threshold", () => {
    expect(deliveryFeeFor(area, 49_999)).toBe(650);
    expect(deliveryFeeFor(area, 50_000)).toBe(0);
  });

  it("builds an inclusive estimated date window", () => {
    const result = deliveryDateRange(area, new Date("2026-08-14T00:00:00+08:00"));
    expect(result.earliest.getDate()).toBe(16);
    expect(result.latest.getDate()).toBe(18);
  });

  it.each([
    ["Metro Manila (National Capital Region — NCR)", "Quezon City", "metro-manila"],
    ["Bulacan", "Malolos", "greater-manila"],
    ["Cebu", "Cebu City", "visayas"],
    ["Davao del Sur", "Davao City", "mindanao"],
    ["Pangasinan", "Dagupan", "luzon"],
  ])("maps %s, %s to %s", (province, city, expected) => {
    expect(deliveryAreaCodeForAddress({ province, city })).toBe(expected);
  });

  it("returns the matching active delivery row", () => {
    expect(deliveryAreaForAddress([area], { province: "Metro Manila", city: "Manila" }))
      .toEqual(area);
  });
});
