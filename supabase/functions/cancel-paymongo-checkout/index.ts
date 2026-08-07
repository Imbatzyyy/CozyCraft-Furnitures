import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { findPaidProviderPayment, providerSessionLivemode } from "../_shared/paymongo-session.ts";

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([canonicalOrigin, "https://cozycraftfurnitures.com"]);
const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("Origin") ?? "")
    ? request.headers.get("Origin")!
    : canonicalOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cozycraft-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(request, { error: "Authentication required." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  const paymongoSecretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !paymongoSecretKey) return json(request, { error: "Server configuration is incomplete." }, 500);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "Invalid session." }, 401);
  const { orderId } = await request.json().catch(() => ({ orderId: "" }));
  const { data: order } = await userClient
    .from("orders")
    .select("id,order_number,total,payment_method,payment_status,status")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) return json(request, { error: "Order not found." }, 404);
  if (order.payment_method === "cod" || order.payment_status !== "pending") {
    return json(request, { error: "This checkout can no longer be cancelled." }, 409);
  }
  const { data: transaction } = await adminClient
    .from("payment_transactions")
    .select("id,provider_session_id,status")
    .eq("order_id", order.id)
    .maybeSingle();
  if (transaction?.provider_session_id) {
    const providerResponse = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(transaction.provider_session_id)}`,
      { headers: { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` } },
    );
    if (!providerResponse.ok) {
      return json(request, { error: "Payment status could not be verified. The order was kept active for your protection." }, 502);
    }
    const providerPayload = await providerResponse.json();
    const paidPayment = findPaidProviderPayment(providerPayload);
    if (paidPayment) {
      const { error: settlementError } = await adminClient.rpc("settle_paymongo_order", {
        p_order_id: order.id,
        p_transaction_id: transaction.id,
        p_provider_payment_id: paidPayment.id,
        p_livemode: providerSessionLivemode(providerPayload),
        p_raw_payload: providerPayload,
      });
      if (settlementError) return json(request, { error: settlementError.message }, 409);
      return json(request, {
        cancelled: false,
        paid: true,
        orderId: order.id,
        orderNumber: order.order_number,
        total: Number(order.total),
      });
    }
  }
  const { error } = await adminClient.rpc("fail_paymongo_order", {
    p_order_id: order.id,
    p_reason: "Customer cancelled PayMongo checkout",
  });
  if (error) return json(request, { error: error.message }, 500);
  return json(request, { cancelled: true, paid: false });
});
