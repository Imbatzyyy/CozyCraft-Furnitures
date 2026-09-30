type ReturnLocation = Pick<Location, "pathname" | "search">;
type ReturnStorage = Pick<Storage, "getItem" | "removeItem">;

// Only a native checkout launcher can opt an exact order into app return.
// Ordinary website payments, including other orders in the same browser, stay web.
export function nativePaymentReturnTarget(location: ReturnLocation, storages: ReturnStorage[], now = Date.now()): string | null {
  if (location.pathname !== "/payment-return") return null;
  const params = new URLSearchParams(location.search);
  const order = params.get("order") || "";
  const payment = params.get("payment");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(order) || !["success", "cancelled"].includes(payment || "")) return null;
  const key = `cozycraft-native-payment-return:${order}`;
  for (const storage of storages) {
    try {
      const expiry = Number(storage.getItem(key));
      if (Number.isFinite(expiry) && expiry > now && expiry <= now + 60 * 60 * 1000) {
        return `/mobile-payment.html?payment=${payment}&order=${encodeURIComponent(order)}`;
      }
      storage.removeItem(key);
    } catch { /* Optional browser storage must not break a website payment. */ }
  }
  return null;
}
