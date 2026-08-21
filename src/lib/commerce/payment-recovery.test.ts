import { describe, expect, it, vi } from "vitest";
import type { DbOrder } from "@/services/supabase/client";
import {
  isRecoverablePendingPayment,
  pendingPaymentRecoveryKey,
  pendingPaymentOrderUrl,
  readPendingPaymentRecovery,
  replaceCheckoutHistoryWithPaymentRecovery,
  writePendingPaymentRecovery,
} from "./payment-recovery";

const order = (overrides: Partial<DbOrder> = {}): DbOrder => ({
  id: "order-1",
  order_number: "CC-1001",
  user_id: "user-1",
  status: "pending",
  payment_method: "gcash",
  payment_status: "pending",
  payment_expires_at: "2026-08-21T10:15:00.000Z",
  subtotal: 1_000,
  delivery_fee: 0,
  total: 1_000,
  shipping_address: {},
  created_at: "2026-08-21T10:00:00.000Z",
  order_items: [],
  order_status_history: [],
  ...overrides,
});

describe("pending PayMongo recovery", () => {
  it("recognizes only an unexpired pending online payment", () => {
    const now = Date.parse("2026-08-21T10:05:00.000Z");
    expect(isRecoverablePendingPayment(order(), now)).toBe(true);
    expect(
      isRecoverablePendingPayment(order({ payment_method: "cod" }), now),
    ).toBe(false);
    expect(
      isRecoverablePendingPayment(order({ payment_status: "paid" }), now),
    ).toBe(false);
    expect(
      isRecoverablePendingPayment(
        order({ payment_expires_at: "2026-08-21T10:04:59.000Z" }),
        now,
      ),
    ).toBe(false);
  });

  it("stores and restores the same-device handoff marker", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const recovery = {
      orderId: "order-1",
      orderNumber: "CC-1001",
      expiresAt: "2026-08-21T10:15:00.000Z",
    };
    writePendingPaymentRecovery(storage, "user-1", recovery);
    expect(values.has(pendingPaymentRecoveryKey("user-1"))).toBe(true);
    expect(
      readPendingPaymentRecovery(
        storage,
        "user-1",
        Date.parse("2026-08-21T10:05:00.000Z"),
      ),
    ).toEqual(recovery);
  });

  it("removes an expired or malformed marker", () => {
    const removeItem = vi.fn();
    const expiredStorage = {
      getItem: () =>
        JSON.stringify({
          orderId: "order-1",
          expiresAt: "2026-08-21T10:00:00.000Z",
        }),
      removeItem,
    };
    expect(
      readPendingPaymentRecovery(
        expiredStorage,
        "user-1",
        Date.parse("2026-08-21T10:00:01.000Z"),
      ),
    ).toBeNull();
    expect(removeItem).toHaveBeenCalledWith(
      pendingPaymentRecoveryKey("user-1"),
    );
  });

  it("synchronously replaces checkout history with the recoverable order", () => {
    const replaceState = vi.fn();
    const history = { state: { idx: 4 }, replaceState };
    expect(
      replaceCheckoutHistoryWithPaymentRecovery(history, "order / 1"),
    ).toBe("/profile?tab=orders&order=order%20%2F%201");
    expect(replaceState).toHaveBeenCalledWith(
      { idx: 4 },
      "",
      "/profile?tab=orders&order=order%20%2F%201",
    );
    expect(pendingPaymentOrderUrl("order / 1")).toBe(
      "/profile?tab=orders&order=order%20%2F%201",
    );
  });
});
