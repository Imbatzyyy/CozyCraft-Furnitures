import { describe, expect, it, vi } from "vitest";
import type { DbOrder } from "@/services/supabase/client";
import {
  cancelledPaymentReturnUrl,
  clearPendingPaymentRecovery,
  isRecoverablePendingPayment,
  paymentHandoffUrl,
  paymentReturnUrl,
  pendingPaymentRecoveryKey,
  pendingPaymentRecoveryEvent,
  pendingPaymentOrderUrl,
  pendingPaymentReturnUrl,
  readPendingPaymentRecovery,
  successfulPaymentReturnUrl,
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
      isRecoverablePendingPayment(order({ payment_method: "card" }), now),
    ).toBe(true);
    expect(
      isRecoverablePendingPayment(order({ payment_status: "paid" }), now),
    ).toBe(false);
    expect(
      isRecoverablePendingPayment(order({ payment_status: "failed" }), now),
    ).toBe(false);
    expect(
      isRecoverablePendingPayment(order({ status: "cancelled" }), now),
    ).toBe(false);
    expect(
      isRecoverablePendingPayment(order({ payment_expires_at: null }), now),
    ).toBe(false);
    expect(
      isRecoverablePendingPayment(
        order({ payment_expires_at: "not-a-date" }),
        now,
      ),
    ).toBe(false);
    expect(
      isRecoverablePendingPayment(
        order({ payment_expires_at: "2026-08-21T10:04:59.000Z" }),
        now,
      ),
    ).toBe(false);
  });

  it("treats the exact expiry instant as expired", () => {
    const expiresAt = "2026-08-21T10:15:00.000Z";
    expect(
      isRecoverablePendingPayment(
        order({ payment_expires_at: expiresAt }),
        Date.parse(expiresAt) - 1,
      ),
    ).toBe(true);
    expect(
      isRecoverablePendingPayment(
        order({ payment_expires_at: expiresAt }),
        Date.parse(expiresAt),
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
    expect(writePendingPaymentRecovery(storage, "user-1", recovery)).toBe(
      true,
    );
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

    removeItem.mockClear();
    const malformedStorage = {
      getItem: () => "{invalid-json",
      removeItem,
    };
    expect(readPendingPaymentRecovery(malformedStorage, "user-1")).toBeNull();
    expect(removeItem).toHaveBeenCalledWith(
      pendingPaymentRecoveryKey("user-1"),
    );
  });

  it("builds encoded cart-independent recovery and order URLs", () => {
    const orderId = "order / 1?next=yes&source=test";
    const encoded = "order%20%2F%201%3Fnext%3Dyes%26source%3Dtest";
    expect(pendingPaymentOrderUrl(orderId)).toBe(
      `/profile?tab=orders&order=${encoded}`,
    );
    expect(pendingPaymentReturnUrl(orderId)).toBe(
      `/payment-return?payment=pending&order=${encoded}`,
    );
    expect(paymentHandoffUrl(orderId)).toBe(
      `/payment-return?payment=handoff&order=${encoded}`,
    );
    expect(successfulPaymentReturnUrl(orderId)).toBe(
      `/payment-return?payment=success&order=${encoded}`,
    );
    expect(cancelledPaymentReturnUrl(orderId)).toBe(
      `/payment-return?payment=cancelled&order=${encoded}`,
    );
    expect(paymentReturnUrl("pending", orderId)).toBe(
      pendingPaymentReturnUrl(orderId),
    );
  });

  it("never throws when storage access is blocked", () => {
    const blockedReadStorage = {
      getItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
    };
    expect(() =>
      readPendingPaymentRecovery(blockedReadStorage, "user-1"),
    ).not.toThrow();
    expect(
      readPendingPaymentRecovery(blockedReadStorage, "user-1"),
    ).toBeNull();

    expect(
      writePendingPaymentRecovery(
        {
          setItem: () => {
            throw new DOMException("Quota exceeded", "QuotaExceededError");
          },
        },
        "user-1",
        {
          orderId: "order-1",
          orderNumber: "CC-1001",
          expiresAt: "2026-08-21T10:15:00.000Z",
        },
      ),
    ).toBe(false);
    expect(
      clearPendingPaymentRecovery(
        {
          removeItem: () => {
            throw new DOMException("Blocked", "SecurityError");
          },
        },
        "user-1",
      ),
    ).toBe(false);
  });

  it("dispatches a same-window marker event after successful writes and clears", () => {
    class TestCustomEvent<T = unknown> extends Event {
      detail: T;

      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail as T;
      }
    }
    const dispatchedEvents: Event[] = [];
    const dispatchEvent = vi.fn((event: Event) => {
      dispatchedEvents.push(event);
      return true;
    });
    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal("CustomEvent", TestCustomEvent);
    const storage = {
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const recovery = {
      orderId: "order-1",
      orderNumber: "CC-1001",
      expiresAt: "2026-08-21T10:15:00.000Z",
    };

    expect(writePendingPaymentRecovery(storage, "user-1", recovery)).toBe(
      true,
    );
    expect(clearPendingPaymentRecovery(storage, "user-1")).toBe(true);

    const dispatched = dispatchedEvents
      .filter((event) => event.type === pendingPaymentRecoveryEvent) as Array<
      CustomEvent
    >;
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0]?.detail).toEqual({ userId: "user-1", recovery });
    expect(dispatched[1]?.detail).toEqual({
      userId: "user-1",
      recovery: null,
    });
    vi.unstubAllGlobals();
  });
});
