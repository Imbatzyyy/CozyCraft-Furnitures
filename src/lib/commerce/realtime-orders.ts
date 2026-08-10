export type OrderRealtimeChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE" | string;
  table: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

export type OrderRealtimeTarget = {
  orderId: string | null;
  removeOrder: boolean;
  announceNewOrder: boolean;
};

const stringField = (
  record: Record<string, unknown> | undefined,
  field: string,
) => (typeof record?.[field] === "string" ? record[field] : null) as
  | string
  | null;

/**
 * Resolves a Supabase Realtime row change to its owning order.
 * Child-row deletes may omit `order_id` unless REPLICA IDENTITY FULL is set,
 * so those safely fall back to a scoped order-list recovery refresh.
 */
export function orderRealtimeTarget(
  payload: OrderRealtimeChange,
): OrderRealtimeTarget {
  if (payload.table === "orders") {
    const orderId =
      stringField(payload.new, "id") ?? stringField(payload.old, "id");
    return {
      orderId,
      removeOrder: payload.eventType === "DELETE" && Boolean(orderId),
      announceNewOrder: payload.eventType === "INSERT" && Boolean(orderId),
    };
  }

  return {
    orderId:
      stringField(payload.new, "order_id") ??
      stringField(payload.old, "order_id"),
    removeOrder: false,
    announceNewOrder: false,
  };
}
