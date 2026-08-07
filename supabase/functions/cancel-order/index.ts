import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

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
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });

const sendRefundEmail = async (email: string | null, orderNumber: string, amount: number, demo: boolean) => {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey || !email) return { sent: false, id: null, error: "Refund email is not configured." };
  try {
    const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CozyCraft Furnitures <no-reply@auth.cozycraftfurnitures.com>",
      to: [email],
      subject: `Order ${orderNumber} cancellation and refund`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#24211e"><h1>CozyCraft Furnitures</h1><h2>Your order was cancelled.</h2><p>Order <strong>${orderNumber}</strong> has been cancelled.</p><p>A ${demo ? "test-mode refund was recorded" : "refund was submitted to your original payment method"} for <strong>₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>.</p><p>You can follow the payment status from your CozyCraft account.</p></div>`,
    }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { sent: false, id: null, error: String(result?.message ?? "Resend rejected the email.").slice(0, 500) };
    }
    return { sent: true, id: result?.id ?? null, error: null };
  } catch (error) {
    return { sent: false, id: null, error: error instanceof Error ? error.message.slice(0, 500) : "Unable to reach Resend." };
  }
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
    return json(request, { error: "Cancellation service is not configured." }, 503);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "Your session has expired." }, 401);
  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["customer", "admin", "superadmin"].includes(profile.role)) {
    return json(request, { error: "This account cannot cancel orders." }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!orderId || reason.length < 5) return json(request, { error: "Provide a cancellation reason." }, 400);

  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select("id,order_number,user_id,status,payment_method,payment_status,total,created_at,profiles(email),payment_transactions(id,status,provider_payment_id,livemode)")
    .eq("id", orderId)
    .single();
  if (orderError || !order) return json(request, { error: "Order not found." }, 404);
  const customerRequest = profile.role === "customer";
  if (customerRequest && order.user_id !== user.id) {
    return json(request, { error: "You can only cancel your own order." }, 403);
  }
  const { data: settings } = await adminClient
    .from("store_settings")
    .select("fulfillment_settings,email_event_settings")
    .eq("id", true)
    .single();
  if (customerRequest) {
    const cancellationHours = Math.max(0, Number(settings?.fulfillment_settings?.cancellation_window_hours) || 0);
    const deadline = new Date(order.created_at).getTime() + cancellationHours * 3_600_000;
    if (!["pending", "processing", "packed"].includes(order.status) || cancellationHours === 0 || Date.now() > deadline) {
      return json(request, { error: `The ${cancellationHours}-hour cancellation window has closed. Contact support for assistance.` }, 409);
    }
  }
  if (["shipped", "delivered"].includes(order.status)) {
    return json(request, { error: "Shipped or delivered orders require a return workflow." }, 409);
  }
  if (order.status === "cancelled") return json(request, { error: "This order is already cancelled." }, 409);

  const transaction = Array.isArray(order.payment_transactions)
    ? order.payment_transactions[0]
    : order.payment_transactions;
  const commonUpdate = {
    cancellation_reason: reason,
    cancellation_requested_at: new Date().toISOString(),
    cancelled_by: user.id,
  };

  if (order.payment_method === "cod" || order.payment_status !== "paid") {
    const { error } = await adminClient.from("orders").update({
      ...commonUpdate,
      status: "cancelled",
      payment_status: order.payment_status === "pending" ? "failed" : order.payment_status,
    }).eq("id", order.id);
    if (error) return json(request, { error: error.message }, 500);
    await adminClient.from("customer_notifications").insert({
      user_id: order.user_id,
      kind: "order_cancelled",
      title: `Order ${order.order_number} cancelled`,
      message: "Your order was cancelled before payment settlement. No refund is required.",
      entity_type: "orders",
      entity_id: order.id,
    });
    return json(request, { cancelled: true, refundStatus: null });
  }

  if (!transaction?.provider_payment_id) {
    return json(request, { error: "The settled PayMongo payment reference is missing. Cancellation was not applied." }, 409);
  }
  await adminClient.from("orders").update({ ...commonUpdate, refund_status: "processing" }).eq("id", order.id);

  let refundId = `demo_refund_${crypto.randomUUID()}`;
  let demo = !transaction.livemode;
  let refundPayload: Record<string, unknown> = { demo: true };
  if (!demo) {
    const response = await fetch("https://api.paymongo.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `cancel-${order.id}`,
      },
      body: JSON.stringify({
        data: { attributes: {
          amount: Math.round(Number(order.total) * 100),
          payment_id: transaction.provider_payment_id,
          reason: "others",
          notes: `Admin cancellation for CozyCraft order ${order.order_number}: ${reason}`,
        } },
      }),
    });
    refundPayload = await response.json();
    if (!response.ok) {
      const message = (refundPayload as any)?.errors?.[0]?.detail ?? "PayMongo rejected the refund.";
      await adminClient.from("orders").update({ refund_status: "failed" }).eq("id", order.id);
      return json(request, { error: `${message} The order remains active and inventory was not restored.` }, 502);
    }
    refundId = String((refundPayload as any)?.data?.id ?? "");
    if (!refundId) {
      await adminClient.from("orders").update({ refund_status: "failed" }).eq("id", order.id);
      return json(request, { error: "PayMongo returned an incomplete refund. The order remains active." }, 502);
    }
  }

  const timestamp = new Date().toISOString();
  const { error: finalizeError } = await adminClient.from("orders").update({
    status: "cancelled",
    payment_status: "refunded",
    refund_status: demo ? "demo_succeeded" : "succeeded",
    provider_refund_id: refundId,
    refunded_at: timestamp,
  }).eq("id", order.id);
  if (finalizeError) return json(request, { error: finalizeError.message }, 500);
  await adminClient.from("payment_transactions").update({
    status: "refunded",
    updated_at: timestamp,
    raw_payload: refundPayload,
  }).eq("id", transaction.id);
  await adminClient.from("customer_notifications").insert({
    user_id: order.user_id,
    kind: "refund_completed",
    title: `Refund recorded for ${order.order_number}`,
    message: demo
      ? "Your test payment refund was completed for this demo order."
      : "Your refund was submitted to the original payment method.",
    entity_type: "orders",
    entity_id: order.id,
  });
  const customerProfile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  const emailResult = settings?.email_event_settings?.cancelled_refunded === false
    ? { sent: false, id: null, error: "Refund confirmation emails are disabled in Store Settings." }
    : await sendRefundEmail(customerProfile?.email ?? null, order.order_number, Number(order.total), demo);
  await adminClient.from("orders").update({
    refund_email_sent_at: emailResult.sent ? new Date().toISOString() : null,
    refund_email_id: emailResult.id,
    refund_email_error: emailResult.error,
  }).eq("id", order.id);
  return json(request, {
    cancelled: true,
    refundStatus: demo ? "demo_succeeded" : "succeeded",
    demo,
    emailSent: emailResult.sent,
    emailError: emailResult.error,
  });
});
