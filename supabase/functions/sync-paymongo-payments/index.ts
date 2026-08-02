import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { findPaidProviderPayment, providerSessionLivemode } from "../_shared/paymongo-session.ts";

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([canonicalOrigin, "https://cozycraftfurnitures.com"]);
const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("Origin") ?? "")
    ? request.headers.get("Origin")!
    : canonicalOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(request, { error: "Authentication required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  const paymongoSecretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !paymongoSecretKey) {
    return json(request, { error: "Payment reconciliation is not configured." }, 503);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "Invalid session." }, 401);

  const body = await request.json().catch(() => ({ orderIds: [] }));
  const orderIds = Array.isArray(body.orderIds)
    ? body.orderIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 20)
    : [];
  if (!orderIds.length) return json(request, { checked: 0, synchronized: 0 });

  const { data: visibleOrders, error: orderError } = await userClient
    .from("orders")
    .select("id,order_number,payment_status,payment_method,payment_transactions(id,provider_session_id,status)")
    .in("id", orderIds)
    .in("payment_method", ["card", "gcash"])
    .eq("payment_status", "pending");
  if (orderError) return json(request, { error: orderError.message }, 500);

  let synchronized = 0;
  for (const order of visibleOrders ?? []) {
    const transaction = Array.isArray(order.payment_transactions)
      ? order.payment_transactions[0]
      : order.payment_transactions;
    if (!transaction?.provider_session_id) continue;

    const response = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(transaction.provider_session_id)}`,
      { headers: { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` } },
    );
    if (!response.ok) continue;
    const payload = await response.json();
    const session = payload?.data;
    const paidPayment = findPaidProviderPayment(payload);

    if (paidPayment) {
      const { error: settlementError } = await adminClient.rpc("settle_paymongo_order", {
        p_order_id: order.id,
        p_transaction_id: transaction.id,
        p_provider_payment_id: paidPayment.id,
        p_livemode: providerSessionLivemode(payload),
        p_raw_payload: payload,
      });
      if (!settlementError) synchronized += 1;
    } else if (session?.attributes?.status === "expired") {
      await adminClient.rpc("fail_paymongo_order", {
        p_order_id: order.id,
        p_reason: "PayMongo checkout session expired",
      });
      synchronized += 1;
    } else {
      await adminClient
        .from("payment_transactions")
        .update({
          provider_status: session?.attributes?.status ?? "active",
          last_synced_at: new Date().toISOString(),
          raw_payload: payload,
        })
        .eq("id", transaction.id)
        .eq("status", "pending");
    }
  }

  return json(request, { checked: visibleOrders?.length ?? 0, synchronized });
});
