import { supabase } from "@/services/supabase/client";
import type { PendingPaymentRecovery } from "@/lib/commerce/payment-recovery";

export type PendingPaymentRecoveryLookup = {
  recovery: PendingPaymentRecovery | null;
  error: string | null;
};

/**
 * Fetch only the three fields needed to restore an interrupted PayMongo
 * handoff. This intentionally avoids loading the full order graph and keeps
 * the reopen/back-button recovery check small for both latency and egress.
 */
export async function findPendingPaymentRecovery(
  userId: string,
  now = new Date(),
  orderId?: string,
): Promise<PendingPaymentRecoveryLookup> {
  let query = supabase
    .from("orders")
    .select("id,order_number,payment_expires_at")
    .eq("user_id", userId)
    .in("payment_method", ["card", "gcash"])
    .eq("payment_status", "pending")
    .neq("status", "cancelled")
    .gt("payment_expires_at", now.toISOString());
  if (orderId) {
    query = query.eq("id", orderId);
  }
  const { data, error } = await query
    .order("payment_expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { recovery: null, error: error.message };
  if (!data?.id || !data.payment_expires_at) {
    return { recovery: null, error: null };
  }

  return {
    recovery: {
      orderId: String(data.id),
      orderNumber:
        typeof data.order_number === "string" ? data.order_number : null,
      expiresAt: String(data.payment_expires_at),
    },
    error: null,
  };
}
