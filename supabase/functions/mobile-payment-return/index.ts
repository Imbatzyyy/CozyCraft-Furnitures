import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { findPaidProviderPayment, providerSessionLivemode } from "../_shared/paymongo-session.ts";

const deepLinkResponse = (payment: "success" | "cancelled", orderId: string) =>
  new Response(null, {
    status: 302,
    headers: {
      "Location": `com.cozycraft.furniture://payment/callback?payment=${payment}&order=${encodeURIComponent(orderId)}`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const payment = url.searchParams.get("payment") === "success" ? "success" : "cancelled";
  const orderId = (url.searchParams.get("order") ?? "").replace(/[^a-zA-Z0-9-]/g, "");

  // A success URL is only a browser handoff and is not proof of payment.
  // Before returning to the app, verify the checkout directly with PayMongo
  // and settle the matching pending order. The webhook remains the fallback.
  if (payment === "success" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
      const paymongoSecretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
      if (supabaseUrl && serviceRoleKey && paymongoSecretKey) {
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: transaction } = await adminClient
          .from("payment_transactions")
          .select("id,provider_session_id,status,orders!inner(id,payment_status,payment_method)")
          .eq("order_id", orderId)
          .maybeSingle();
        const order = Array.isArray(transaction?.orders) ? transaction.orders[0] : transaction?.orders;
        if (transaction?.provider_session_id && transaction.status === "pending" && order?.payment_status === "pending" && ["card", "gcash"].includes(order?.payment_method)) {
          const providerResponse = await fetch(
            `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(transaction.provider_session_id)}`,
            { headers: { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` } },
          );
          if (providerResponse.ok) {
            const providerPayload = await providerResponse.json();
            const paidPayment = findPaidProviderPayment(providerPayload);
            if (paidPayment) {
              const { error } = await adminClient.rpc("settle_paymongo_order", {
                p_order_id: orderId,
                p_transaction_id: transaction.id,
                p_provider_payment_id: paidPayment.id,
                p_livemode: providerSessionLivemode(providerPayload),
                p_raw_payload: providerPayload,
              });
              if (error) console.error("PayMongo return settlement failed", error.message);
            }
          }
        }
      }
    } catch (error) {
      // Never strand the customer in the browser. A verified webhook or the
      // authenticated app reconciliation will finish settlement if needed.
      console.error("PayMongo return reconciliation failed", error);
    }
  }

  return deepLinkResponse(payment, orderId);
});
