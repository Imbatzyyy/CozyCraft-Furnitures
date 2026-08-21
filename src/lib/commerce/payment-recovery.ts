import type { DbOrder } from "@/services/supabase/client";

export type PendingPaymentRecovery = {
  orderId: string;
  orderNumber: string | null;
  expiresAt: string;
};

const keyPrefix = "cozycraft-pending-payment";

export const pendingPaymentRecoveryKey = (userId: string) =>
  `${keyPrefix}:${userId}`;

export const isRecoverablePendingPayment = (
  order: DbOrder,
  now = Date.now(),
) =>
  ["card", "gcash"].includes(order.payment_method) &&
  order.payment_status === "pending" &&
  order.status !== "cancelled" &&
  Boolean(order.payment_expires_at) &&
  Date.parse(order.payment_expires_at ?? "") > now;

export const readPendingPaymentRecovery = (
  storage: Pick<Storage, "getItem" | "removeItem">,
  userId: string,
  now = Date.now(),
): PendingPaymentRecovery | null => {
  const key = pendingPaymentRecoveryKey(userId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingPaymentRecovery>;
    if (
      typeof value.orderId !== "string" ||
      !value.orderId ||
      typeof value.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(value.expiresAt)) ||
      Date.parse(value.expiresAt) <= now
    ) {
      storage.removeItem(key);
      return null;
    }
    return {
      orderId: value.orderId,
      orderNumber:
        typeof value.orderNumber === "string" ? value.orderNumber : null,
      expiresAt: value.expiresAt,
    };
  } catch {
    storage.removeItem(key);
    return null;
  }
};

export const writePendingPaymentRecovery = (
  storage: Pick<Storage, "setItem">,
  userId: string,
  recovery: PendingPaymentRecovery,
) => {
  storage.setItem(pendingPaymentRecoveryKey(userId), JSON.stringify(recovery));
};

export const clearPendingPaymentRecovery = (
  storage: Pick<Storage, "removeItem">,
  userId: string,
) => storage.removeItem(pendingPaymentRecoveryKey(userId));

