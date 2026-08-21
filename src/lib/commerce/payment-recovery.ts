import type { DbOrder } from "@/services/supabase/client";

export type PendingPaymentRecovery = {
  orderId: string;
  orderNumber: string | null;
  expiresAt: string;
};

const keyPrefix = "cozycraft-pending-payment";

export const pendingPaymentRecoveryEvent =
  "cozycraft:pending-payment-recovery-changed";

export type PaymentReturnState =
  | "handoff"
  | "pending"
  | "success"
  | "cancelled";

export type PendingPaymentRecoveryEventDetail = {
  userId: string;
  recovery: PendingPaymentRecovery | null;
};

export const pendingPaymentRecoveryKey = (userId: string) =>
  `${keyPrefix}:${userId}`;

export const pendingPaymentOrderUrl = (orderId: string) =>
  `/profile?tab=orders&order=${encodeURIComponent(orderId)}`;

export const paymentReturnUrl = (
  state: PaymentReturnState,
  orderId: string,
) => `/payment-return?payment=${state}&order=${encodeURIComponent(orderId)}`;

export const pendingPaymentReturnUrl = (orderId: string) =>
  paymentReturnUrl("pending", orderId);

export const paymentHandoffUrl = (orderId: string) =>
  paymentReturnUrl("handoff", orderId);

export const successfulPaymentReturnUrl = (orderId: string) =>
  paymentReturnUrl("success", orderId);

export const cancelledPaymentReturnUrl = (orderId: string) =>
  paymentReturnUrl("cancelled", orderId);

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
  const removeInvalidMarker = () => {
    try {
      storage.removeItem(key);
    } catch {
      // Recovery is best-effort. A blocked storage API must not break checkout.
    }
  };

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
      removeInvalidMarker();
      return null;
    }
    return {
      orderId: value.orderId,
      orderNumber:
        typeof value.orderNumber === "string" ? value.orderNumber : null,
      expiresAt: value.expiresAt,
    };
  } catch {
    removeInvalidMarker();
    return null;
  }
};

const dispatchPendingPaymentRecoveryEvent = (
  detail: PendingPaymentRecoveryEventDetail,
) => {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function" ||
    typeof CustomEvent !== "function"
  ) {
    return;
  }

  try {
    window.dispatchEvent(
      new CustomEvent<PendingPaymentRecoveryEventDetail>(
        pendingPaymentRecoveryEvent,
        { detail },
      ),
    );
  } catch {
    // Same-window notification is an enhancement, never a checkout dependency.
  }
};

export const writePendingPaymentRecovery = (
  storage: Pick<Storage, "setItem">,
  userId: string,
  recovery: PendingPaymentRecovery,
) => {
  try {
    storage.setItem(
      pendingPaymentRecoveryKey(userId),
      JSON.stringify(recovery),
    );
    dispatchPendingPaymentRecoveryEvent({ userId, recovery });
    return true;
  } catch {
    return false;
  }
};

export const clearPendingPaymentRecovery = (
  storage: Pick<Storage, "removeItem">,
  userId: string,
) => {
  try {
    storage.removeItem(pendingPaymentRecoveryKey(userId));
    dispatchPendingPaymentRecoveryEvent({ userId, recovery: null });
    return true;
  } catch {
    return false;
  }
};
