import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([
  canonicalOrigin,
  "https://cozycraftfurnitures.com",
]);
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

const failOrder = async (
  adminClient: ReturnType<typeof createClient>,
  orderId: string | null,
  reason: string,
) => {
  if (!orderId) return;
  await adminClient.rpc("fail_paymongo_order", {
    p_order_id: orderId,
    p_reason: reason,
  });
};

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
    return json(request, { error: "PayMongo checkout is not configured yet." }, 503);
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

  let payload: { addressId?: string; paymentMethod?: string; returnOrigin?: string; checkoutKey?: string; items?: Array<{ product_id: string; quantity: number }> };
  try {
    payload = await request.json();
  } catch {
    return json(request, { error: "Invalid checkout request." }, 400);
  }

  const requestOrigin = request.headers.get("Origin") ?? "";
  const returnOrigin = allowedOrigins.has(payload.returnOrigin ?? "")
    ? payload.returnOrigin!
    : allowedOrigins.has(requestOrigin)
      ? requestOrigin
      : canonicalOrigin;

  const paymentMethod = payload.paymentMethod;
  if (!payload.addressId || !["card", "gcash"].includes(paymentMethod ?? "")) {
    return json(request, { error: "Choose a valid delivery address and payment method." }, 400);
  }
  if (!payload.checkoutKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.checkoutKey)) {
    return json(request, { error: "Invalid checkout key." }, 400);
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 50) {
    return json(request, { error: "Your checkout selection is empty or too large." }, 400);
  }
  const items = payload.items.map((item) => ({
    product_id: String(item.product_id ?? ""),
    quantity: Number(item.quantity),
  }));
  if (items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return json(request, { error: "One or more checkout quantities are invalid." }, 400);
  }

  let orderId: string | null = null;
  try {
    const { data, error } = await userClient.rpc("place_order", {
      p_address_id: payload.addressId,
      p_payment_method: paymentMethod,
      p_items: items,
      p_checkout_key: payload.checkoutKey,
    });
    if (error) return json(request, { error: error.message }, 400);
    orderId = data as string;

    const { data: existingTransaction } = await adminClient
      .from("payment_transactions")
      .select("checkout_url,status")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existingTransaction?.checkout_url && existingTransaction.status === "pending") {
      const { data: existingOrder } = await adminClient.from("orders").select("order_number").eq("id", orderId).single();
      return json(request, { orderId, orderNumber: existingOrder?.order_number ?? null, checkoutUrl: existingTransaction.checkout_url, reused: true });
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id,order_number,total,shipping_address,order_items(product_name,unit_price,quantity)")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();
    if (orderError || !order) throw new Error("The reserved order could not be loaded.");

    const lineItems = order.order_items.map((item: { product_name: string; unit_price: number; quantity: number }) => ({
      name: item.product_name.slice(0, 255),
      amount: Math.round(Number(item.unit_price) * 100),
      currency: "PHP",
      quantity: item.quantity,
    }));
    const merchandiseTotal = order.order_items.reduce(
      (sum: number, item: { unit_price: number; quantity: number }) =>
        sum + Number(item.unit_price) * item.quantity,
      0,
    );
    const deliveryFee = Math.max(0, Number(order.total) - merchandiseTotal);
    if (deliveryFee > 0) {
      lineItems.push({
        name: "CozyCraft delivery",
        amount: Math.round(deliveryFee * 100),
        currency: "PHP",
        quantity: 1,
      });
    }
    const shipping = order.shipping_address as Record<string, string>;
    const paymongoResponse = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: lineItems,
            payment_method_types: [paymentMethod],
            success_url: `${returnOrigin}/checkout?payment=success&order=${order.id}`,
            cancel_url: `${returnOrigin}/checkout?payment=cancelled&order=${order.id}`,
            reference_number: order.order_number,
            description: `CozyCraft order ${order.order_number}`,
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            billing: {
              name: shipping.name,
              email: shipping.email,
              phone: shipping.mobile,
            },
            metadata: { order_id: order.id, user_id: user.id },
          },
        },
      }),
    });
    const paymongoBody = await paymongoResponse.json();
    if (!paymongoResponse.ok) {
      const message = paymongoBody?.errors?.[0]?.detail ?? "PayMongo could not create the checkout session.";
      throw new Error(message);
    }

    const session = paymongoBody.data;
    const checkoutUrl = session?.attributes?.checkout_url;
    if (!session?.id || !checkoutUrl) throw new Error("PayMongo returned an incomplete checkout session.");

    const { error: transactionError } = await adminClient.from("payment_transactions").insert({
      order_id: order.id,
      provider_session_id: session.id,
      checkout_url: checkoutUrl,
      status: "pending",
      amount: order.total,
      livemode: Boolean(session.attributes?.livemode),
      raw_payload: session,
    });
    if (transactionError) throw transactionError;

    return json(request, {
      orderId: order.id,
      orderNumber: order.order_number,
      checkoutUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start PayMongo checkout.";
    await failOrder(adminClient, orderId, message);
    return json(request, { error: message }, 502);
  }
});
