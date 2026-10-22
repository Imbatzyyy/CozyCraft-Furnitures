// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultStoreSettings } from "@/lib/settings/store-settings";
import { Checkout } from "./ShoppingAndCheckout";

const mocks = vi.hoisted(() => ({
  store: {} as Record<string, unknown>,
  policy: { loading: false, error: "", codLimit: 20_000, outstandingCod: 0, retry: vi.fn() },
  placeOrder: vi.fn(),
  delivery: vi.fn(),
  voucher: { id: "voucher", status: "available", discount_amount: 500, minimum_order_amount: 1, expires_at: "2099-01-01T00:00:00Z" },
}));
vi.mock("@/app/core", () => ({
  useStore: () => mocks.store,
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
  money: (amount: number) => `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
}));
vi.mock("@/services/supabase/client", () => ({ supabase: {} }));
vi.mock("@/services/catalog/experience.service", () => ({ getDeliveryServiceAreas: mocks.delivery }));
vi.mock("@/lib/commerce/use-checkout-payment-policy", () => ({ useCheckoutPaymentPolicy: () => mocks.policy }));
vi.mock("../authentication/CustomerAuth", () => ({ Account: () => null }));
vi.mock("../account/CustomerAccount", () => ({ AddressManager: () => null }));
vi.mock("../account/CheckoutVouchers", () => ({
  CheckoutVouchers: ({ onSelect }: { onSelect: (voucher: unknown) => void }) => <>
    <button onClick={() => onSelect(mocks.voucher)}>Use test voucher</button>
    <button onClick={() => onSelect(null)}>Remove test voucher</button>
  </>,
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const product = (price: number) => ({ id: "test-chair", name: "Test chair", price, images: [], stock: 20 });
const method = (name: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
const submit = () => host.querySelector<HTMLButtonElement>("#checkout-summary button")!;
async function render() {
  await act(async () => root.render(<MemoryRouter initialEntries={["/checkout"]}><Checkout /></MemoryRouter>));
}
async function clickText(text: string) {
  const button = [...host.querySelectorAll("button")].find(item => item.textContent === text)!;
  await act(async () => button.click());
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.policy.loading = false;
  mocks.policy.error = "";
  mocks.policy.outstandingCod = 0;
  mocks.voucher.expires_at = "2099-01-01T00:00:00Z";
  mocks.delivery.mockResolvedValue([{ area_code: "metro-manila", name: "Metro Manila", delivery_fee: 650, free_delivery_minimum: null, lead_time_min_days: 2, lead_time_max_days: 4, assembly_available: true, active: true }]);
  mocks.store = {
    authReady: true, user: "Test customer", userId: "test-user", cart: [{ id: "test-chair", quantity: 1 }],
    products: [product(19_350)], orders: [], refreshOrders: vi.fn(), placeOrder: mocks.placeOrder,
    profilePaymentMethod: "cod", storeSettings: structuredClone(defaultStoreSettings),
    addresses: [{ id: "test-address", primary: true, label: "Home", name: "Test Customer", mobile: "09000000000", email: "customer@example.test", line: "Test street", barangay: "Test", city: "Quezon City", province: "Metro Manila", postal: "1100" }],
  };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("website checkout uses the mobile final-total payment policy", () => {
  it.each([[19_349.99, true], [19_350, true], [19_350.01, false]])("subtotal %s plus delivery has COD eligibility %s", async (price, eligible) => {
    mocks.store.products = [product(price)];
    await render();
    expect(method("Cash on delivery").disabled).toBe(!eligible);
    expect(submit().disabled).toBe(!eligible);
    expect(method("GCash").disabled).toBe(false);
    expect(method("Debit or credit card").disabled).toBe(false);
    if (!eligible) expect(submit().textContent).toBe("Choose a payment method");
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });
  it("re-evaluates after vouchers without silently switching payment methods", async () => {
    mocks.store.products = [product(19_850)];
    await render();
    expect(method("Cash on delivery").disabled).toBe(true);
    await clickText("Use test voucher");
    expect(method("Cash on delivery").disabled).toBe(false);
    // Restoring eligibility does not silently select a payment method.
    expect(submit().disabled).toBe(true);
    await act(async () => method("Cash on delivery").click());
    expect(submit().disabled).toBe(false);
    await clickText("Remove test voucher");
    expect(method("Cash on delivery").disabled).toBe(true);
    expect(submit().disabled).toBe(true);
    expect(method("GCash").getAttribute("aria-pressed")).toBe("false");
    await act(async () => method("GCash").click());
    expect(submit().disabled).toBe(false);
  });
  it("keeps online payments selectable when the COD policy cannot load", async () => {
    mocks.policy.error = "We couldn’t check your COD availability. Retry or choose an online payment.";
    await render();
    expect(method("Cash on delivery").disabled).toBe(true);
    expect(method("GCash").disabled).toBe(false);
    await clickText("Retry COD availability");
    expect(mocks.policy.retry).toHaveBeenCalledTimes(1);
    await act(async () => method("Debit or credit card").click());
    expect(submit().disabled).toBe(false);
  });
  it("explains when every payment method is disabled", async () => {
    mocks.store.storeSettings = {
      ...structuredClone(defaultStoreSettings),
      checkout_settings: { ...defaultStoreSettings.checkout_settings, cod_enabled: false, card_enabled: false, gcash_enabled: false },
    };
    await render();
    expect(submit().disabled).toBe(true);
    expect(submit().textContent).toBe("No payment method available");
  });
  it("blocks COD submission while checking availability", async () => {
    mocks.policy.loading = true;
    await render();
    expect(method("Cash on delivery").disabled).toBe(true);
    expect(submit().disabled).toBe(true);
    expect(host.textContent).toContain("Checking COD availability");
  });
  it("accounts for existing unpaid COD orders without blocking online payment", async () => {
    mocks.policy.outstandingCod = 1;
    await render();
    expect(method("Cash on delivery").disabled).toBe(true);
    expect(host.textContent).toContain("unpaid COD orders");
    expect(method("GCash").disabled).toBe(false);
  });
  it("submits an eligible COD order with the chosen address and method", async () => {
    mocks.placeOrder.mockResolvedValue({ error: "Fixture: no real order was created" });
    await render();
    await act(async () => submit().click());
    expect(mocks.placeOrder).toHaveBeenCalledWith("test-address", "cod", undefined, undefined, undefined, expect.any(Number));
    expect(host.textContent).toContain("Fixture: no real order was created");
  });
  it("blocks all methods above the store ceiling before payment authorization", async () => {
    mocks.store.products = [product(1_250_000)];
    mocks.placeOrder.mockResolvedValue({ error: "Fixture: provider approval is still required" });
    await render();
    expect(method("Cash on delivery").disabled).toBe(true);
    expect(method("GCash").disabled).toBe(true);
    expect(method("Debit or credit card").disabled).toBe(true);
    expect(host.textContent).toContain("₱500,000");
    expect(submit().disabled).toBe(true);
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });
  it("blocks payment while a bag update is pending or failed", async () => {
    mocks.store.cartBusy = true;
    await render();
    expect(submit().disabled).toBe(true);
    expect(host.textContent).toContain("Saving your bag changes");
  });
});
