import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([
  canonicalOrigin,
  "https://cozycraftfurnitures.com",
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
]);
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
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]!);
const render = (template: string, variables: Record<string, string>) =>
  Object.entries(variables).reduce(
    (value, [key, replacement]) => value.replaceAll(`{{${key}}}`, replacement),
    template,
  );

const eventSettingKey = {
  order_confirmation: "order_confirmation",
  payment_received: "payment_received",
  fulfillment_update: "fulfillment_updates",
  delivered: "delivered",
  cancelled_refunded: "cancelled_refunded",
  support_reply: "support_replies",
} as const;
type EventType = keyof typeof eventSettingKey;

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
    return json(request, { error: "Transactional email service is not configured." }, 503);
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
  const { data: caller } = await adminClient
    .from("profiles")
    .select("role,staff_active,customer_active")
    .eq("id", user.id)
    .single();
  const isStaff = Boolean(caller?.staff_active && ["staff", "admin", "superadmin"].includes(caller.role));
  if (!isStaff && caller?.customer_active === false) {
    return json(request, { error: "This customer account is suspended." }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const eventType = typeof body.eventType === "string" ? body.eventType as EventType : "" as EventType;
  if (!(eventType in eventSettingKey)) return json(request, { error: "Unsupported email event." }, 400);
  const force = body.force === true && isStaff;
  let entityType = "order";
  let entityId = "";
  let recipient = "";
  let recipientName = "there";
  const variables: Record<string, string> = {
    order_number: "your order",
    ticket_number: "your support ticket",
    status: "updated",
    refund_status: "updated",
  };

  if (eventType === "support_reply") {
    if (!isStaff) return json(request, { error: "Staff access is required for support replies." }, 403);
    entityType = "support_ticket";
    entityId = typeof body.ticketId === "string" ? body.ticketId : "";
    const { data: ticket, error } = await adminClient
      .from("support_tickets")
      .select("id,user_id,ticket_number,admin_reply")
      .eq("id", entityId)
      .single();
    if (error || !ticket) return json(request, { error: "Support ticket not found." }, 404);
    if (!String(ticket.admin_reply ?? "").trim()) return json(request, { error: "Save a support reply before sending its email." }, 409);
    const { data: customer } = await adminClient.from("profiles").select("email,full_name").eq("id", ticket.user_id).single();
    recipient = String(customer?.email ?? "").trim();
    recipientName = String(customer?.full_name ?? "there");
    variables.ticket_number = String(ticket.ticket_number ?? "your support ticket");
  } else {
    entityId = typeof body.orderId === "string" ? body.orderId : "";
    const { data: order, error } = await adminClient
      .from("orders")
      .select("id,user_id,order_number,status,payment_status,refund_status")
      .eq("id", entityId)
      .single();
    if (error || !order) return json(request, { error: "Order not found." }, 404);
    if (!isStaff && order.user_id !== user.id) return json(request, { error: "You cannot access this order." }, 403);
    if (!isStaff && eventType !== "order_confirmation" && eventType !== "payment_received") {
      return json(request, { error: "Staff access is required for this event." }, 403);
    }
    if (eventType === "payment_received" && order.payment_status !== "paid") {
      return json(request, { error: "Payment has not been confirmed yet." }, 409);
    }
    if (eventType === "delivered" && order.status !== "delivered") {
      return json(request, { error: "The order is not delivered yet." }, 409);
    }
    if (eventType === "cancelled_refunded" && order.status !== "cancelled") {
      return json(request, { error: "The order has not been cancelled." }, 409);
    }
    const { data: customer } = await adminClient.from("profiles").select("email,full_name").eq("id", order.user_id).single();
    recipient = String(customer?.email ?? "").trim();
    recipientName = String(customer?.full_name ?? "there");
    variables.order_number = String(order.order_number ?? "your order");
    variables.status = String(order.status ?? "updated").replaceAll("_", " ");
    variables.refund_status = String(order.refund_status ?? order.payment_status ?? "updated").replaceAll("_", " ");
  }
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return json(request, { error: "The customer account has no valid email address." }, 409);
  }

  const [{ data: settings }, { data: template }] = await Promise.all([
    adminClient.from("store_settings").select("store_name,contact_email,email_event_settings").eq("id", true).single(),
    adminClient.from("email_templates").select("subject_template,heading,body_template,enabled").eq("event_type", eventType).single(),
  ]);
  const eventEnabled = settings?.email_event_settings?.[eventSettingKey[eventType]] !== false;
  if (!eventEnabled || template?.enabled === false) {
    await adminClient.from("email_delivery_logs").insert({
      event_type: eventType, entity_type: entityType, entity_id: entityId,
      recipient, status: "skipped", error_message: "Disabled in administrator settings.", sent_by: user.id,
    });
    return json(request, { sent: false, skipped: true });
  }
  if (!template) return json(request, { error: "Email template is unavailable." }, 503);

  if (!force) {
    const recentBoundary = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: recent } = await adminClient
      .from("email_delivery_logs")
      .select("id,provider_message_id")
      .eq("event_type", eventType)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("status", "sent")
      .gte("created_at", recentBoundary)
      .limit(1)
      .maybeSingle();
    if (recent) return json(request, { sent: true, duplicate: true, emailId: recent.provider_message_id });
  }

  const subject = render(template.subject_template, variables).slice(0, 180);
  const heading = escapeHtml(render(template.heading, variables));
  const message = escapeHtml(render(template.body_template, variables));
  const storeName = escapeHtml(settings?.store_name || "CozyCraft Furnitures");
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "CozyCraft Furnitures <no-reply@auth.cozycraftfurnitures.com>",
      to: [recipient],
      reply_to: settings?.contact_email || undefined,
      subject,
      html: `<div style="background:#f4f0e8;padding:32px 16px;font-family:Arial,sans-serif;color:#24211e"><div style="max-width:620px;margin:auto;background:#fff;border-radius:24px;overflow:hidden"><div style="padding:28px 32px;border-bottom:1px solid #e5ded3;text-align:center"><img src="${canonicalOrigin}/email-logo.png" alt="${storeName}" width="150" style="max-width:150px;height:auto"><p style="font-size:11px;letter-spacing:2px;color:#776f65">CUSTOMER CARE</p></div><div style="padding:34px 32px"><h1 style="font-family:Georgia,serif;font-size:34px;line-height:1.15;margin:0 0 18px">${heading}</h1><p>Hello ${escapeHtml(recipientName)},</p><p style="line-height:1.7">${message}</p><p style="margin-top:28px"><a href="${canonicalOrigin}/profile" style="display:inline-block;background:#201e1b;color:#fff;text-decoration:none;border-radius:12px;padding:14px 20px;font-weight:bold">View your CozyCraft account</a></p></div><div style="padding:20px 32px;background:#eee8de;color:#6f675e;font-size:12px;line-height:1.6">This transactional message was sent because of activity on your ${storeName} account.</div></div></div>`,
    }),
  });
  const provider = await result.json().catch(() => ({}));
  if (!result.ok) {
    const errorMessage = String(provider?.message ?? provider?.error?.message ?? "Resend rejected the email.").slice(0, 500);
    await adminClient.from("email_delivery_logs").insert({
      event_type: eventType, entity_type: entityType, entity_id: entityId,
      recipient, status: "failed", error_message: errorMessage, sent_by: user.id,
    });
    return json(request, { error: errorMessage }, 502);
  }
  await adminClient.from("email_delivery_logs").insert({
    event_type: eventType, entity_type: entityType, entity_id: entityId,
    recipient, status: "sent", provider_message_id: provider?.id ?? null, sent_by: user.id,
  });
  return json(request, { sent: true, emailId: provider?.id ?? null, recipient });
});
