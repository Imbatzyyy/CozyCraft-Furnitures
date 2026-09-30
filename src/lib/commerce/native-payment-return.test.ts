import { describe, expect, it } from "vitest";
import { nativePaymentReturnTarget } from "./native-payment-return";
import { paymentReturnUrls } from "../../../supabase/functions/_shared/payment-return";

const order = "11111111-1111-4111-8111-111111111111";
const now = 100_000;
const location = { pathname: "/payment-return", search: `?payment=success&order=${order}` };
const store = (expiry: unknown, storedOrder = order) => ({
  getItem: (key: string) => key === `cozycraft-native-payment-return:${storedOrder}` ? String(expiry) : null,
  removeItem: () => undefined,
});

describe("native payment return routing", () => {
  it("creates dedicated app returns for native GCash/card checkouts", () => {
    expect(paymentReturnUrls(order, true)).toEqual({
      success_url: `https://www.cozycraftfurnitures.com/mobile-payment.html?payment=success&order=${order}`,
      cancel_url: `https://www.cozycraftfurnitures.com/mobile-payment.html?payment=cancelled&order=${order}`,
    });
  });
  it("preserves website return destinations and encodes order input", () => {
    expect(paymentReturnUrls(order, false).success_url).toBe(`https://www.cozycraftfurnitures.com/payment-return?payment=success&order=${order}`);
    expect(paymentReturnUrls('x&redirect=https://evil.test', true).success_url).not.toContain('&redirect=');
  });
  it("recovers a legacy or web-created payment resumed by the app", () => {
    expect(nativePaymentReturnTarget(location, [store(now + 1000)], now)).toBe(`/mobile-payment.html?payment=success&order=${order}`);
    expect(nativePaymentReturnTarget({ ...location, search: `?payment=cancelled&order=${order}` }, [store(now + 1000)], now)).toBe(`/mobile-payment.html?payment=cancelled&order=${order}`);
  });
  it("does not hijack website orders, other orders or expired markers", () => {
    expect(nativePaymentReturnTarget(location, [], now)).toBeNull();
    expect(nativePaymentReturnTarget(location, [store(now + 1000, 'different-order')], now)).toBeNull();
    for (const expiry of [now, now - 1, 'bad', Infinity, now + 3_600_001]) {
      expect(nativePaymentReturnTarget(location, [store(expiry)], now)).toBeNull();
    }
    expect(nativePaymentReturnTarget({ ...location, pathname: '/orders' }, [store(now + 1000)], now)).toBeNull();
  });
  it("rejects malformed order IDs and unknown statuses", () => {
    for (const search of ['?payment=success&order=bad', `?payment=paid&order=${order}`, `?order=${order}`]) {
      expect(nativePaymentReturnTarget({ ...location, search }, [store(now + 1000)], now)).toBeNull();
    }
  });
  it("uses the surviving store if browser storage is restricted", () => {
    const denied = { getItem: () => { throw new Error('denied'); }, removeItem: () => undefined };
    expect(nativePaymentReturnTarget(location, [denied], now)).toBeNull();
    expect(nativePaymentReturnTarget(location, [denied, store(now + 1000)], now)).not.toBeNull();
  });
});
