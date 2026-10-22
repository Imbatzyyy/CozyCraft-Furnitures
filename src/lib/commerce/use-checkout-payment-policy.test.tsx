// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCheckoutPaymentPolicy } from "./use-checkout-payment-policy";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), read: vi.fn() }));
vi.mock("@/services/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let current: ReturnType<typeof useCheckoutPaymentPolicy>;
function Probe({ userId }: { userId?: string }) {
  current = useCheckoutPaymentPolicy(userId);
  return <p>{current.loading ? "loading" : current.error || current.outstandingCod}</p>;
}
const render = async (userId?: string) => act(async () => root.render(<Probe userId={userId} />));
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.rpc.mockImplementation(() => ({ abortSignal: mocks.read }));
  mocks.read.mockResolvedValue({ data: { cod_limit: 20_000, outstanding_cod_total: 1500 }, error: null });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.useRealTimers();
});

describe("bounded account-scoped checkout policy", () => {
  it("loads once without polling and only retries explicitly", async () => {
    await render("customer-a");
    expect(current.outstandingCod).toBe(1500);
    await render("customer-a");
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await act(async () => current.retry());
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenCalledWith("get_checkout_payment_policy");
  });
  it("does not fetch when signed out", async () => {
    await render();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("times out a stalled read and allows retry", async () => {
    mocks.read.mockImplementationOnce((signal: AbortSignal) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    await render("customer-a");
    expect(current.loading).toBe(true);
    await act(async () => vi.advanceTimersByTime(12_000));
    expect(current.loading).toBe(false);
    expect(current.error).toContain("Retry");
    await act(async () => current.retry());
    expect(current.error).toBe("");
    expect(current.outstandingCod).toBe(1500);
  });
  it("ignores a late response from the previous account", async () => {
    let resolveOld!: (result: unknown) => void;
    let oldSignal!: AbortSignal;
    mocks.read.mockImplementationOnce((signal: AbortSignal) => {
      oldSignal = signal;
      return new Promise(resolve => { resolveOld = resolve; });
    });
    await render("customer-a");
    await render("customer-b");
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld({ data: { cod_limit: 20_000, outstanding_cod_total: 19_000 }, error: null }));
    expect(current.owner).toBe("customer-b");
    expect(current.outstandingCod).toBe(1500);
  });
  it.each([null, { cod_limit: null, outstanding_cod_total: null }, { cod_limit: 20_000, outstanding_cod_total: -1 }])("fails closed on invalid policy %j", async data => {
    mocks.read.mockResolvedValueOnce({ data, error: null });
    await render("customer-a");
    expect(current.loading).toBe(false);
    expect(current.error).toContain("Retry");
  });
});
