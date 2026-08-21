export type PaymentHandoff = {
  userId: string;
  orderId: string;
  orderNumber: string | null;
  checkoutUrl: string;
  expiresAt: string;
};

const handoffPrefix = "cozycraft-payment-handoff";

export const paymentHandoffStorageKey = (orderId: string) =>
  `${handoffPrefix}:${orderId}`;

export const isTrustedPayMongoCheckoutUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "paymongo.com" ||
        url.hostname.endsWith(".paymongo.com"))
    );
  } catch {
    return false;
  }
};

export const stagePaymentHandoff = (
  storage: Pick<Storage, "setItem">,
  handoff: PaymentHandoff,
) => {
  if (
    !handoff.userId ||
    !handoff.orderId ||
    !isTrustedPayMongoCheckoutUrl(handoff.checkoutUrl) ||
    !Number.isFinite(Date.parse(handoff.expiresAt)) ||
    Date.parse(handoff.expiresAt) <= Date.now()
  ) {
    return false;
  }

  try {
    storage.setItem(
      paymentHandoffStorageKey(handoff.orderId),
      JSON.stringify(handoff),
    );
    return true;
  } catch {
    return false;
  }
};

export const readPaymentHandoff = (
  storage: Pick<Storage, "getItem" | "removeItem">,
  orderId: string,
  userId: string,
  now = Date.now(),
): PaymentHandoff | null => {
  const key = paymentHandoffStorageKey(orderId);
  const discard = () => {
    try {
      storage.removeItem(key);
    } catch {
      // A blocked storage API must never break the server-backed fallback.
    }
  };

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PaymentHandoff>;
    if (
      value.userId !== userId ||
      value.orderId !== orderId ||
      typeof value.checkoutUrl !== "string" ||
      !isTrustedPayMongoCheckoutUrl(value.checkoutUrl) ||
      typeof value.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(value.expiresAt)) ||
      Date.parse(value.expiresAt) <= now
    ) {
      discard();
      return null;
    }

    return {
      userId,
      orderId,
      orderNumber:
        typeof value.orderNumber === "string" ? value.orderNumber : null,
      checkoutUrl: value.checkoutUrl,
      expiresAt: value.expiresAt,
    };
  } catch {
    discard();
    return null;
  }
};

export const consumePaymentHandoff = (
  storage: Pick<Storage, "getItem" | "removeItem">,
  orderId: string,
  userId: string,
) => {
  const key = paymentHandoffStorageKey(orderId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return false;
    let ownedByUser = false;
    try {
      const value = JSON.parse(raw) as Partial<PaymentHandoff>;
      ownedByUser = value.orderId === orderId && value.userId === userId;
    } catch {
      // Malformed one-time records are consumed below and rejected.
    }
    storage.removeItem(key);
    return ownedByUser;
  } catch {
    return false;
  }
};
