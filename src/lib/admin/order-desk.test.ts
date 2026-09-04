import { describe, expect, it } from "vitest";
import type { DbOrder } from "@/services/supabase/client";
import {
  ADMIN_ORDERS_PER_PAGE,
  DEFAULT_ADMIN_ORDER_FILTERS,
  adminOrderSelectionParams,
  filterAdminOrders,
  isOrderReadyForFulfillment,
  orderMatchesSavedView,
  paginateAdminOrders,
} from "./order-desk";

function order(overrides: Partial<DbOrder> = {}): DbOrder {
  return {
    id: "order-1",
    order_number: "CC-00001",
    user_id: "customer-1",
    status: "pending",
    payment_method: "cod",
    payment_status: "pending",
    subtotal: 1000,
    delivery_fee: 100,
    total: 1100,
    shipping_address: {
      name: "Joy Customer",
      email: "joy@example.com",
      mobile: "+639171234567",
    },
    created_at: "2026-08-31T08:00:00.000Z",
    order_items: [
      {
        id: 1,
        product_id: "chair-1",
        product_name: "Mara Chair",
        unit_price: 1000,
        quantity: 1,
        image_url: null,
      },
    ],
    order_status_history: [],
    ...overrides,
  };
}

describe("admin order desk", () => {
  it("shows five orders per page and carries later orders to the next page", () => {
    const ordered = Array.from({ length: 7 }, (_, index) =>
      order({ id: `order-${index + 1}` }),
    );

    expect(ADMIN_ORDERS_PER_PAGE).toBe(5);
    expect(paginateAdminOrders(ordered, 1).map((item) => item.id)).toEqual([
      "order-1",
      "order-2",
      "order-3",
      "order-4",
      "order-5",
    ]);
    expect(paginateAdminOrders(ordered, 2).map((item) => item.id)).toEqual([
      "order-6",
      "order-7",
    ]);
  });

  it("keeps the active date tab when an order is selected", () => {
    const current = new URLSearchParams("view=needs_fulfillment&q=chair");
    const next = adminOrderSelectionParams(current, "order-2", "today");

    expect(next.get("order")).toBe("order-2");
    expect(next.get("range")).toBe("today");
    expect(next.get("view")).toBe("needs_fulfillment");
    expect(next.get("q")).toBe("chair");
  });

  it("opens on today's Philippine queue with the first placed order first", () => {
    expect(DEFAULT_ADMIN_ORDER_FILTERS.dateRange).toBe("today");
    expect(DEFAULT_ADMIN_ORDER_FILTERS.sort).toBe("oldest");

    const results = filterAdminOrders(
      [
        order({ id: "later-today", created_at: "2026-09-05T00:00:00.000Z" }),
        order({ id: "yesterday", created_at: "2026-09-04T15:59:00.000Z" }),
        order({ id: "first-today", created_at: "2026-09-04T16:05:00.000Z" }),
      ],
      DEFAULT_ADMIN_ORDER_FILTERS,
      { now: new Date("2026-09-05T00:30:00.000Z") },
    );

    expect(results.map((item) => item.id)).toEqual([
      "first-today",
      "later-today",
    ]);
  });

  it("only queues paid or COD orders that can safely move through fulfillment", () => {
    expect(isOrderReadyForFulfillment(order())).toBe(true);
    expect(
      isOrderReadyForFulfillment(
        order({ payment_method: "gcash", payment_status: "pending" }),
      ),
    ).toBe(false);
    expect(
      isOrderReadyForFulfillment(
        order({ payment_method: "card", payment_status: "paid" }),
      ),
    ).toBe(true);
    expect(
      isOrderReadyForFulfillment(order({ cancellation_status: "pending" })),
    ).toBe(false);
  });

  it("supports action-oriented saved views", () => {
    const cancellation = order({ id: "cancel", cancellation_status: "pending" });
    const refund = order({ id: "refund", refund_status: "failed" });
    expect(orderMatchesSavedView(cancellation, "cancellation_requests")).toBe(true);
    expect(orderMatchesSavedView(refund, "refund_attention")).toBe(true);
    expect(
      orderMatchesSavedView(order({ id: "return" }), "returns", new Set(["return"])),
    ).toBe(true);
  });

  it("combines search, structured filters, dates, and sorting without new queries", () => {
    const results = filterAdminOrders(
      [
        order({ id: "older", total: 5000, created_at: "2026-08-29T08:00:00.000Z" }),
        order({
          id: "newer",
          order_number: "CC-CHAIR",
          total: 2500,
          created_at: "2026-09-01T04:00:00.000Z",
          payment_method: "card",
          payment_status: "paid",
          status: "processing",
        }),
      ],
      {
        ...DEFAULT_ADMIN_ORDER_FILTERS,
        query: "chair",
        view: "needs_fulfillment",
        paymentMethod: "card",
        dateRange: "last_7_days",
        sort: "highest_total",
      },
      { now: new Date("2026-09-01T12:00:00.000Z") },
    );
    expect(results.map((item) => item.id)).toEqual(["newer"]);
  });
});
