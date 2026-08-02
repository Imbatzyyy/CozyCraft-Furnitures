import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

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
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !resendKey) {
    return json(request, { error: "Refund email service is not configured." }, 503);
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
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return json(request, { error: "Administrator access is required." }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select("id,order_number,status,payment_status,refund_status,total,cancellation_reason,profiles!orders_user_id_fkey(email,full_name)")
    .eq("id", orderId)
    .single();
  if (orderError || !order) return json(request, { error: "Order not found." }, 404);
  if (order.status !== "cancelled" || order.payment_status !== "refunded") {
    return json(request, { error: "A refund email is only available for cancelled, refunded orders." }, 409);
  }
  const customer = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  if (!customer?.email) return json(request, { error: "This customer account has no email address." }, 409);

  const demo = order.refund_status === "demo_succeeded";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CozyCraft Furnitures <no-reply@auth.cozycraftfurnitures.com>",
      to: [customer.email],
      subject: `Refund confirmation for order ${order.order_number}`,
      html: `<div style="background:#f5f1e9;padding:32px 16px;font-family:Arial,sans-serif;color:#24211e"><div style="max-width:600px;margin:auto;background:white;border-radius:24px;padding:32px"><p style="font-size:12px;letter-spacing:2px;color:#776f65">COZYCRAFT FURNITURES</p><h1 style="font-family:Georgia,serif;font-size:34px">Your refund is confirmed.</h1><p>Hello ${customer.full_name || "there"},</p><p>Order <strong>${order.order_number}</strong> was cancelled.</p><p>${demo ? "A test-mode refund has been recorded for your demonstration transaction." : "Your refund has been submitted to the original payment method."}</p><div style="margin:24px 0;padding:18px;border-radius:14px;background:#eee8de"><strong>Refund amount: ₱${Number(order.total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>${order.cancellation_reason ? `<br><span style="color:#6f675e">Reason: ${order.cancellation_reason}</span>` : ""}</div><p>You can review the latest status from your CozyCraft account.</p></div></div>`,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result?.message ?? result?.error?.message ?? "Resend rejected the email.";
    await adminClient.from("orders").update({ refund_email_error: String(message).slice(0, 500) }).eq("id", order.id);
    return json(request, { error: message }, 502);
  }
  const sentAt = new Date().toISOString();
  await adminClient.from("orders").update({
    refund_email_sent_at: sentAt,
    refund_email_id: result?.id ?? null,
    refund_email_error: null,
  }).eq("id", order.id);
  return json(request, { sent: true, emailId: result?.id ?? null, recipient: customer.email });
});
