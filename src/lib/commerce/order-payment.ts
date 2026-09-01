import type { DbOrder } from "@/services/supabase/client";

type PaymentOrder = Pick<
  DbOrder,
  | "order_number"
  | "status"
  | "payment_method"
  | "payment_status"
  | "payment_transactions"
>;

export const effectiveOrderPaymentStatus = (order: PaymentOrder) =>
  order.payment_method === "cod" && order.status === "delivered"
    ? "paid"
    : order.payment_status;

export const orderPaymentMethodLabel = (method: string) => {
  const normalizedMethod = typeof method === "string" ? method : "payment";
  if (normalizedMethod === "cod") return "Cash on delivery";
  if (normalizedMethod === "gcash") return "GCash";
  if (normalizedMethod === "card") return "Card";
  return normalizedMethod
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const orderPaymentReference = (order: PaymentOrder) => {
  if (order.payment_method === "cod") {
    return `COD-${order.order_number}`;
  }

  const transactions = Array.isArray(order.payment_transactions)
    ? order.payment_transactions.filter(Boolean)
    : [];
  const transaction = transactions
    .filter((item) => item.status === "paid")
    .sort(
      (left, right) =>
        (Date.parse(String(right.paid_at ?? right.updated_at ?? "")) || 0) -
        (Date.parse(String(left.paid_at ?? left.updated_at ?? "")) || 0),
    )[0];

  return (
    transaction?.provider_payment_id ??
    transaction?.provider_session_id ??
    `PAY-${order.order_number}`
  );
};
