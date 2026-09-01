import { describe, expect, it } from "vitest";
import type { DbOrder } from "@/services/supabase/client";
import { buildPackingListData } from "./packing-list";

const sampleOrder: DbOrder = {
  id: "order-1",
  order_number: "CC-01042",
  user_id: "customer-1",
  status: "processing",
  payment_method: "cod",
  payment_status: "pending",
  subtotal: 5000,
  delivery_fee: 500,
  total: 5500,
  shipping_address: {
    name: "Joy Customer",
    email: "joy@example.com",
    mobile: "+639171234567",
    line: "Purok 1",
    barangay: "Esperanza",
    city: "Bacolod",
    province: "Negros Occidental",
    postal: "6100",
    note: "Call before arrival",
  },
  created_at: "2026-09-01T03:00:00.000Z",
  order_items: [
    {
      id: 1,
      product_id: "chair-1",
      product_name: "Mara Chair",
      unit_price: 2000,
      quantity: 2,
      image_url: null,
    },
    {
      id: 2,
      product_id: null,
      product_name: "Lamp",
      unit_price: 1000,
      quantity: 1,
      image_url: null,
    },
  ],
  order_status_history: [],
};

describe("admin packing list", () => {
  it("prepares fulfillment details and unit totals from the selected order", () => {
    const data = buildPackingListData(
      sampleOrder,
      new Date("2026-09-01T05:00:00.000Z"),
    );
    expect(data.orderNumber).toBe("CC-01042");
    expect(data.customerName).toBe("Joy Customer");
    expect(data.deliveryAddress).toBe(
      "Purok 1, Esperanza, Bacolod, Negros Occidental, 6100",
    );
    expect(data.deliveryNote).toBe("Call before arrival");
    expect(data.paymentSummary).toBe("COD · Collect on delivery");
    expect(data.itemCount).toBe(2);
    expect(data.unitCount).toBe(3);
    expect(data.lines[1]).toMatchObject({ productId: "—", quantity: 1 });
  });

  it("uses safe fallbacks when optional delivery fields are unavailable", () => {
    const data = buildPackingListData({
      ...sampleOrder,
      payment_method: "card",
      payment_status: "paid",
      shipping_address: {},
      profiles: {
        full_name: "Account Name",
        email: "account@example.com",
        phone: null,
      },
    });
    expect(data.customerName).toBe("Account Name");
    expect(data.customerEmail).toBe("account@example.com");
    expect(data.customerMobile).toBe("Not provided");
    expect(data.deliveryAddress).toBe("Delivery address not provided");
    expect(data.deliveryNote).toBe("No delivery note");
    expect(data.paymentSummary).toBe("CARD · Paid");
  });
});
