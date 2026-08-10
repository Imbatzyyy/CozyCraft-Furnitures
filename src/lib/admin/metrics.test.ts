import { describe, expect, it } from "vitest";
import {
  customerLifetimeValue,
  isSettledSale,
  reportRangeStart,
  settledRevenue,
} from "./metrics";

const orders = [
  { total: 1200, status: "delivered", payment_status: "paid", user_id: "a" },
  { total: "800", status: "processing", payment_status: "paid", user_id: "a" },
  { total: 500, status: "pending", payment_status: "pending", user_id: "a" },
  { total: 900, status: "cancelled", payment_status: "paid", user_id: "a" },
  { total: 700, status: "cancelled", payment_status: "refunded", user_id: "a" },
  { total: 400, status: "delivered", payment_status: "paid", user_id: "b" },
];

describe("admin financial metrics", () => {
  it("counts only paid, non-cancelled orders as settled sales", () => {
    expect(orders.map(isSettledSale)).toEqual([
      true,
      true,
      false,
      false,
      false,
      true,
    ]);
    expect(settledRevenue(orders)).toBe(2400);
  });

  it("calculates lifetime value from settled purchases for one customer", () => {
    expect(customerLifetimeValue(orders, "a")).toBe(2000);
    expect(customerLifetimeValue(orders, "b")).toBe(400);
  });

  it("uses calendar boundaries for report ranges", () => {
    const now = new Date(2026, 7, 2, 15, 30);
    expect(reportRangeStart("This week", now)).toEqual(new Date(2026, 6, 27));
    expect(reportRangeStart("This month", now)).toEqual(new Date(2026, 7, 1));
    expect(reportRangeStart("Quarter", now)).toEqual(new Date(2026, 6, 1));
  });
});
