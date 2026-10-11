import { describe, expect, it } from "vitest";
import {
  deliveryAreaCodeForAddress,
  deliveryAreaForAddress,
  deliveryDateRange,
  formatDeliveryDate,
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
    expect(result.earliest.toISOString()).toBe("2026-08-15T16:00:00.000Z");
    expect(result.latest.toISOString()).toBe("2026-08-17T16:00:00.000Z");
    expect(formatDeliveryDate(result.earliest)).toBe("Aug 16");
    expect(formatDeliveryDate(result.latest)).toBe("Aug 18");
  });

  it("keeps Philippine dates across a visitor's daylight-saving transition", () => {
    const result = deliveryDateRange(area, new Date("2026-03-07T16:30:00Z"));
    expect(result.earliest.toISOString()).toBe("2026-03-09T16:30:00.000Z");
    expect(formatDeliveryDate(result.earliest)).toBe("Mar 10");
    expect(formatDeliveryDate(result.latest)).toBe("Mar 12");
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
