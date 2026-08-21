import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { findPaidProviderPayment, providerSessionLivemode } from "../_shared/paymongo-session.ts";
import { reconcileElapsedPaymongoSession } from "../_shared/paymongo-expiry.ts";

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
    .select("id,order_number,total,payment_method,payment_status,status,payment_expires_at")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) return json(request, { error: "Order not found." }, 404);
  if (order.payment_method === "cod" || order.payment_status !== "pending" || order.status === "cancelled") {
    return json(request, { error: "This checkout no longer has a pending online payment." }, 409);
  }
  const { data: transaction } = await adminClient
    .from("payment_transactions")
    .select("id,provider_session_id,status,checkout_url,expires_at")
    .eq("order_id", order.id)
    .maybeSingle();
  if (transaction?.provider_session_id) {
    const providerResponse = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(transaction.provider_session_id)}`,
      {
        headers: { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` },
        signal: AbortSignal.timeout(12_000),
      },
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
    if (providerPayload?.data?.attributes?.status === "expired") {
      const reconciliation = await reconcileElapsedPaymongoSession({
        adminClient,
        orderId: order.id,
        transaction,
        secretKey: paymongoSecretKey,
        reason: "PayMongo checkout session expired",
      });
      if (reconciliation.outcome === "paid") {
        return json(request, {
          cancelled: false,
          paid: true,
          orderId: order.id,
          orderNumber: order.order_number,
          total: Number(order.total),
        });
      }
      if (reconciliation.outcome === "expired") {
        return json(request, { cancelled: true, paid: false, expired: true });
      }
      return json(request, { error: reconciliation.message, retryable: true }, 503);
    }
  }

  const expiresAt = order.payment_expires_at ?? transaction?.expires_at ?? null;
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
    if (!transaction?.provider_session_id) {
      return json(request, {
        error: "The payment session reference is unavailable. The order was kept active for safety.",
        retryable: true,
      }, 503);
    }
    const reconciliation = await reconcileElapsedPaymongoSession({
      adminClient,
      orderId: order.id,
      transaction,
      secretKey: paymongoSecretKey,
    });
    if (reconciliation.outcome === "paid") {
      return json(request, {
        cancelled: false,
        paid: true,
        orderId: order.id,
        orderNumber: order.order_number,
        total: Number(order.total),
      });
    }
    if (reconciliation.outcome === "expired") {
      return json(request, { cancelled: true, paid: false, expired: true });
    }
    return json(request, { error: reconciliation.message, retryable: true }, 503);
  }

  // Leaving PayMongo pauses the checkout; it does not immediately destroy the
  // order or release inventory. The server-backed deadline lets the customer
  // safely continue on this or another signed-in device.
  return json(request, {
    cancelled: false,
    paused: true,
    paid: false,
    orderId: order.id,
    orderNumber: order.order_number,
    total: Number(order.total),
    expiresAt,
  });
});
