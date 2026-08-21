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
  "Access-Control-Max-Age": "86400",
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
    return json(request, { error: "Payment recovery is not configured." }, 503);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "Your session has expired. Please sign in again." }, 401);

  const { orderId } = await request.json().catch(() => ({ orderId: "" }));
  if (typeof orderId !== "string" || !orderId) {
    return json(request, { error: "Choose a valid order." }, 400);
  }

  const { data: order, error: orderError } = await userClient
    .from("orders")
    .select("id,order_number,total,payment_method,payment_status,status,payment_expires_at")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (orderError) return json(request, { error: orderError.message }, 500);
  if (!order) return json(request, { error: "Order not found." }, 404);
  if (!["card", "gcash"].includes(order.payment_method) || order.payment_status !== "pending" || order.status === "cancelled") {
    return json(request, { error: "This order no longer has a pending online payment." }, 409);
  }

  const expiry = order.payment_expires_at ? Date.parse(order.payment_expires_at) : Number.NaN;
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    await adminClient.rpc("expire_paymongo_order", {
      p_order_id: order.id,
      p_reason: "PayMongo payment window expired",
    });
    return json(request, { error: "The 15-minute payment window has expired.", expired: true }, 410);
  }

  const { data: transaction, error: transactionError } = await adminClient
    .from("payment_transactions")
    .select("id,provider_session_id,checkout_url,status,expires_at")
    .eq("order_id", order.id)
    .maybeSingle();
  if (transactionError) return json(request, { error: transactionError.message }, 500);
  if (!transaction?.provider_session_id || !transaction.checkout_url || transaction.status !== "pending") {
    return json(request, { error: "The secure payment session is no longer available." }, 409);
  }

  // Verify once, only when the customer asks to continue. The visible timer
  // itself never polls PayMongo or Supabase.
  const providerResponse = await fetch(
    `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(transaction.provider_session_id)}`,
    {
      headers: { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` },
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!providerResponse.ok) {
    return json(request, { error: "The payment session could not be verified. Please try again shortly." }, 502);
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
      paid: true,
      orderId: order.id,
      orderNumber: order.order_number,
      total: Number(order.total),
    });
  }

  const providerStatus = providerPayload?.data?.attributes?.status;
  if (providerStatus === "expired") {
    await adminClient.rpc("expire_paymongo_order", {
      p_order_id: order.id,
      p_reason: "PayMongo checkout session expired",
    });
    return json(request, { error: "The secure PayMongo session has expired.", expired: true }, 410);
  }

  return json(request, {
    paid: false,
    orderId: order.id,
    orderNumber: order.order_number,
    checkoutUrl: transaction.checkout_url,
    expiresAt: order.payment_expires_at,
  });
});
