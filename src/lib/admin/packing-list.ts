import type { DbOrder } from "@/services/supabase/client";

export type PackingListLine = {
  id: number;
  productId: string;
  productName: string;
  quantity: number;
};

export type PackingListData = {
  orderNumber: string;
  orderId: string;
  placedAt: string;
  printedAt: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  deliveryAddress: string;
  deliveryNote: string;
  paymentSummary: string;
  itemCount: number;
  unitCount: number;
  lines: PackingListLine[];
};

const firstText = (...values: Array<unknown>) =>
  values.find((value) => typeof value === "string" && value.trim()) as string | undefined;

export function buildPackingListData(
  order: DbOrder,
  printedAt: Date = new Date(),
): PackingListData {
  const shipping = order.shipping_address;
  const addressParts = [
    firstText(shipping.line, shipping.address_line),
    shipping.barangay,
    shipping.city,
    shipping.province,
    firstText(shipping.postal, shipping.postal_code),
  ].filter((value): value is string => Boolean(value?.trim()));
  const paymentMethod = order.payment_method.toUpperCase();
  const paymentState =
    order.payment_method.toLowerCase() === "cod" && order.payment_status === "pending"
      ? "Collect on delivery"
      : order.payment_status.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
  const lines = order.order_items.map((item, index) => ({
    id: index + 1,
    productId: item.product_id || "—",
    productName: item.product_name,
    quantity: item.quantity,
  }));

  return {
    orderNumber: order.order_number,
    orderId: order.id,
    placedAt: order.created_at,
    printedAt: printedAt.toISOString(),
    customerName:
      firstText(shipping.name, order.profiles?.full_name) || "CozyCraft customer",
    customerEmail:
      firstText(shipping.email, order.profiles?.email) || "Not provided",
    customerMobile:
      firstText(shipping.mobile, order.profiles?.phone) || "Not provided",
    deliveryAddress: addressParts.join(", ") || "Delivery address not provided",
    deliveryNote:
      firstText(shipping.note, shipping.delivery_note) || "No delivery note",
    paymentSummary: `${paymentMethod} · ${paymentState}`,
    itemCount: lines.length,
    unitCount: lines.reduce((total, line) => total + line.quantity, 0),
    lines,
  };
}
