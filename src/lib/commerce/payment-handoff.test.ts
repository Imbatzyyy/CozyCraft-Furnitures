import { describe, expect, it, vi } from "vitest";

import {
  consumePaymentHandoff,
  isTrustedPayMongoCheckoutUrl,
  paymentHandoffStorageKey,
  readPaymentHandoff,
  stagePaymentHandoff,
} from "./payment-handoff";

const future = "2026-08-21T10:15:00.000Z";
const now = Date.parse("2026-08-21T10:05:00.000Z");

const value = {
  userId: "user-1",
  orderId: "order-1",
  orderNumber: "CC-1001",
  checkoutUrl: "https://checkout.paymongo.com/cs_test_123",
  expiresAt: future,
};

describe("PayMongo payment handoff", () => {
  it("accepts only HTTPS PayMongo checkout hosts", () => {
    expect(isTrustedPayMongoCheckoutUrl(value.checkoutUrl)).toBe(true);
    expect(
      isTrustedPayMongoCheckoutUrl("https://paymongo.com/checkout/test"),
    ).toBe(true);
    expect(
      isTrustedPayMongoCheckoutUrl("https://paymongo.com.attacker.test/x"),
    ).toBe(false);
    expect(isTrustedPayMongoCheckoutUrl("http://checkout.paymongo.com/x")).toBe(
      false,
    );
    expect(isTrustedPayMongoCheckoutUrl("not-a-url")).toBe(false);
  });

  it("stages and restores one validated handoff", () => {
    const values = new Map<string, string>();
    const storage = {
      setItem: (key: string, next: string) => values.set(key, next),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    };

    vi.spyOn(Date, "now").mockReturnValue(now);
    expect(stagePaymentHandoff(storage, value)).toBe(true);
    expect(
      readPaymentHandoff(storage, value.orderId, value.userId, now),
    ).toEqual(value);
    expect(consumePaymentHandoff(storage, value.orderId, value.userId)).toBe(true);
    expect(values.has(paymentHandoffStorageKey(value.orderId))).toBe(false);
    vi.restoreAllMocks();
  });

  it("discards expired, mismatched, malformed, and untrusted records", () => {
    const removeItem = vi.fn();
    const record = (next: unknown) => ({
      getItem: () => JSON.stringify(next),
      removeItem,
    });

    expect(
      readPaymentHandoff(record({ ...value, orderId: "another-order" }), "order-1", value.userId, now),
    ).toBeNull();
    expect(
      readPaymentHandoff(
        record({ ...value, userId: "another-user" }),
        "order-1",
        value.userId,
        now,
      ),
    ).toBeNull();
    expect(
      readPaymentHandoff(
        record({ ...value, checkoutUrl: "https://example.com/steal" }),
        "order-1",
        value.userId,
        now,
      ),
    ).toBeNull();
    expect(
      readPaymentHandoff(
        record({ ...value, expiresAt: "2026-08-21T10:05:00.000Z" }),
        "order-1",
        value.userId,
        now,
      ),
    ).toBeNull();
    expect(
      readPaymentHandoff(
        { getItem: () => "{broken", removeItem },
        "order-1",
        value.userId,
        now,
      ),
    ).toBeNull();
    expect(removeItem).toHaveBeenCalled();
  });

  it("rejects and consumes a handoff owned by another user", () => {
    const key = paymentHandoffStorageKey(value.orderId);
    const values = new Map([[key, JSON.stringify(value)]]);
    const storage = {
      getItem: (storageKey: string) => values.get(storageKey) ?? null,
      removeItem: (storageKey: string) => values.delete(storageKey),
    };

    expect(consumePaymentHandoff(storage, value.orderId, "user-2")).toBe(false);
    expect(values.has(key)).toBe(false);
  });

  it("does not stage invalid or already-expired handoffs", () => {
    const setItem = vi.fn();
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(
      stagePaymentHandoff(
        { setItem },
        { ...value, userId: "" },
      ),
    ).toBe(false);
    expect(
      stagePaymentHandoff(
        { setItem },
        { ...value, orderId: "" },
      ),
    ).toBe(false);
    expect(
      stagePaymentHandoff(
        { setItem },
        { ...value, checkoutUrl: "https://example.com/not-paymongo" },
      ),
    ).toBe(false);
    expect(
      stagePaymentHandoff(
        { setItem },
        { ...value, expiresAt: new Date(now).toISOString() },
      ),
    ).toBe(false);
    expect(setItem).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("never throws when browser storage is blocked", () => {
    const blocked = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    expect(stagePaymentHandoff({ setItem: blocked }, value)).toBe(false);
    expect(
      readPaymentHandoff(
        { getItem: blocked, removeItem: blocked },
        value.orderId,
        value.userId,
        now,
      ),
    ).toBeNull();
    expect(
      consumePaymentHandoff(
        { getItem: blocked, removeItem: blocked },
        value.orderId,
        value.userId,
      ),
    ).toBe(false);
  });
});
