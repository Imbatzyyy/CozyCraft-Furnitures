import { describe, expect, it } from "vitest";
import type { DbOrder } from "@/services/supabase/client";
import { defaultStoreSettings } from "@/lib/settings/store-settings";
import { createOrderInvoicePdf, orderInvoiceBreakdown } from "./order-invoice";

const order = {
  subtotal: 7_999,
  delivery_fee: 2_250,
  reward_discount: 0,
  total: 10_249,
} as DbOrder;

describe("digital invoice totals", () => {
  it("preserves the exact stored order fees", () => {
    expect(orderInvoiceBreakdown(order)).toEqual({
      subtotal: 7_999,
      deliveryFee: 2_250,
      discount: 0,
      discountLabel: "Order discount",
      adjustment: 0,
      total: 10_249,
    });
  });

  it("shows Home Circle rewards without changing the final total", () => {
    expect(
      orderInvoiceBreakdown({
        ...order,
        reward_discount: 700,
        total: 9_549,
      }),
    ).toMatchObject({
      discount: 700,
      discountLabel: "Home Circle reward",
      adjustment: 0,
      total: 9_549,
    });
  });

  it("reconciles historical totals with an explicit adjustment", () => {
    expect(
      orderInvoiceBreakdown({
        ...order,
        total: 10_349,
      }),
    ).toMatchObject({ adjustment: 100, total: 10_349 });
  });
});

describe("digital invoice availability", () => {
  const deliveredOrder = {
    id: "order-1",
    order_number: "CC-01098",
    user_id: "customer-1",
    status: "delivered",
    payment_method: "cod",
    payment_status: "pending",
    subtotal: 7_999,
    delivery_fee: 2_250,
    reward_discount: 0,
    total: 10_249,
    shipping_address: {
      name: "CozyCraft Customer",
      email: "customer@example.com",
      mobile: "+639171234567",
      line: "Purok 1 Esperanza",
      barangay: "Esperanza",
      city: "Bacolod",
      province: "Negros Occidental",
      postal: "6100",
    },
    created_at: "2026-08-24T11:03:00.000Z",
    order_items: [
      {
        id: 1,
        product_id: "product-1",
        product_name: "HEMLINGBY",
        unit_price: 7_999,
        quantity: 1,
        image_url: null,
      },
    ],
    order_status_history: [
      {
        id: 1,
        order_id: "order-1",
        status: "delivered",
        changed_at: "2026-08-25T03:27:00.000Z",
        changed_by: null,
      },
    ],
  } satisfies DbOrder;

  const invoiceInput = {
    order: deliveredOrder,
    billing: {
      user_id: "customer-1",
      recipient_name: "CozyCraft Customer",
      company_name: "",
      tax_id: "",
      invoice_email: "customer@example.com",
      address_line: "",
      barangay: "",
      city: "",
      province: "",
      postal_code: "",
      same_as_delivery: true,
    },
    customer: {
      name: "CozyCraft Customer",
      email: "customer@example.com",
      phone: "+639171234567",
    },
    store: defaultStoreSettings,
    generatedAt: new Date("2026-08-25T04:00:00.000Z"),
  };

  it("creates the shared customer/admin PDF for delivered orders", () => {
    expect(createOrderInvoicePdf(invoiceInput).byteLength).toBeGreaterThan(5_000);
  });

  it("refuses to create a receipt before delivery", () => {
    expect(() =>
      createOrderInvoicePdf({
        ...invoiceInput,
        order: { ...deliveredOrder, status: "shipped" },
      }),
    ).toThrow("available after delivery");
  });
});
