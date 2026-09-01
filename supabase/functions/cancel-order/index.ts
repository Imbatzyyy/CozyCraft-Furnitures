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
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
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
  const [profileResult, securityResult] = await Promise.all([
    adminClient.from("profiles").select("role,staff_active").eq("id", user.id).single(),
    adminClient.from("admin_security_settings").select("require_admin_mfa").eq("id", true).maybeSingle(),
  ]);
  const profile = profileResult.data;
  const security = securityResult.data;
  if (securityResult.error || !security) {
    return json(request, { error: "Administrator security policy is unavailable. Try again shortly." }, 503);
  }
  const assurance = String(user.aud ?? "") === "authenticated"
    ? ((user as unknown as { aal?: string }).aal ?? String(user.app_metadata?.aal ?? ""))
    : "";
  const jwtAal = authorization.startsWith("Bearer ")
    ? (() => {
        try {
          const encoded = authorization.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
          const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
          return String(payload.aal ?? "aal1");
        } catch { return assurance || "aal1"; }
      })()
    : assurance || "aal1";
  if (!profile?.staff_active || !["admin", "superadmin"].includes(profile.role)) {
    return json(request, { error: "An administrator must approve or reject cancellation requests." }, 403);
  }
  if ((security.require_admin_mfa ?? true) && jwtAal !== "aal2") {
    return json(request, { error: "Complete administrator MFA before approving financial changes." }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (body.action !== "approve" && body.action !== "reject") {
    return json(request, { error: "Action must be approve or reject." }, 400);
  }
  const action: "approve" | "reject" = body.action;
  const suppliedReason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const decisionNote = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (!orderId) return json(request, { error: "Order is required." }, 400);

  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select("id,order_number,user_id,status,payment_method,payment_status,total,created_at,cancellation_status,cancellation_reason,cancellation_requested_at,refund_status,provider_refund_id,profiles(email),payment_transactions(id,status,provider_payment_id,livemode,paid_at,updated_at)")
    .eq("id", orderId)
    .single();
  if (orderError || !order) return json(request, { error: "Order not found." }, 404);
  const reason = suppliedReason || String(order.cancellation_reason ?? "").trim();
  if (reason.length < 5) return json(request, { error: "Provide a cancellation reason." }, 400);
  const { data: settings } = await adminClient
    .from("store_settings")
    .select("fulfillment_settings,email_event_settings")
    .eq("id", true)
    .single();
  if (["shipped", "delivered"].includes(order.status)) {
    return json(request, { error: "This order has already shipped and can no longer be cancelled." }, 409);
  }

  if (action === "reject") {
    if (order.cancellation_status !== "pending") {
      return json(request, { error: "There is no pending cancellation request to reject." }, 409);
    }
    const { data: reviewed, error } = await adminClient.rpc("reject_admin_order_cancellation", {
      p_order_id: order.id,
      p_reviewer: user.id,
      p_note: decisionNote || null,
    });
    if (error) return json(request, { error: error.message }, 500);
    if (!reviewed) return json(request, { error: "This cancellation request was already reviewed." }, 409);
    return json(request, { reviewed: true, cancellationStatus: "rejected" });
  }

  const transactions = Array.isArray(order.payment_transactions)
    ? order.payment_transactions
    : order.payment_transactions ? [order.payment_transactions] : [];
  const transaction = [...transactions]
    .filter((candidate) => candidate.provider_payment_id)
    .sort((left, right) => Date.parse(right.paid_at ?? right.updated_at) - Date.parse(left.paid_at ?? left.updated_at))[0];
  const requiresRefund = order.payment_method !== "cod" && ["paid", "refunded"].includes(order.payment_status);
  if (requiresRefund && !transaction?.provider_payment_id) {
    return json(request, { error: "The settled PayMongo payment reference is missing. Cancellation was not applied." }, 409);
  }
  if (requiresRefund && order.payment_status === "paid" && transaction.status !== "paid") {
    return json(request, { error: "The PayMongo ledger is not in a settled state. Cancellation was not applied." }, 409);
  }
  const claimToken = crypto.randomUUID();
  const { data: claim, error: claimError } = await adminClient.rpc("claim_admin_order_cancellation", {
    p_order_id: order.id,
    p_reviewer: user.id,
    p_reason: reason,
    p_claim_token: claimToken,
    p_note: decisionNote || null,
  });
  if (claimError) return json(request, { error: claimError.message }, 409);
  if (claim?.alreadyProcessing) {
    return json(request, { error: "A refund is already processing for this order. Refresh shortly before retrying." }, 409);
  }

  if (!requiresRefund) {
    const { data: ledger, error } = await adminClient.rpc("finalize_admin_order_cancellation", {
      p_order_id: order.id,
      p_reviewer: user.id,
      p_reason: reason,
      p_claim_token: claimToken,
      p_note: decisionNote || null,
      p_refund_id: null,
      p_demo: false,
      p_raw_payload: {},
    });
    if (error) return json(request, { error: error.message }, 500);
    return json(request, { cancelled: true, refundStatus: null, ledger, claim });
  }

  const releaseClaim = async (message: string) => {
    const { error } = await adminClient.rpc("release_admin_order_cancellation_claim", {
      p_order_id: order.id,
      p_reviewer: user.id,
      p_claim_token: claimToken,
      p_failure: message,
    });
    return error
      ? `${message} The cancellation claim could not be released automatically: ${error.message}`
      : message;
  };

  let refundId = String(order.provider_refund_id ?? "") || `demo_refund_${crypto.randomUUID()}`;
  let demo = order.refund_status === "demo_succeeded" || !transaction.livemode;
  let refundPayload: Record<string, unknown> = order.provider_refund_id ? { repaired: true } : { demo: true };
  if (!order.provider_refund_id && !demo) {
    if (!paymongoSecretKey) {
      const message = await releaseClaim("PayMongo refunds are not configured. The order remains active and queued for review.");
      return json(request, { error: message }, 503);
    }
    let response: Response;
    try {
      response = await fetch("https://api.paymongo.com/v1/refunds", {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
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
    } catch {
      return json(request, { error: "The payment provider could not be reached. The order remains locked for an idempotent retry." }, 503);
    }
    refundPayload = await response.json();
    if (!response.ok) {
      const providerMessage = (refundPayload as any)?.errors?.[0]?.detail ?? "PayMongo rejected the refund.";
      if (response.status >= 500 || [409, 429].includes(response.status)) {
        return json(request, { error: `${providerMessage} The order remains locked for an idempotent retry.` }, 502);
      }
      const message = await releaseClaim(`${providerMessage} The order remains active and inventory was not restored.`);
      return json(request, { error: message }, 502);
    }
    refundId = String((refundPayload as any)?.data?.id ?? "");
    if (!refundId) {
      return json(request, { error: "PayMongo returned an incomplete refund. The order remains locked for safe retry." }, 502);
    }
  }

  const { data: ledger, error: finalizeError } = await adminClient.rpc("finalize_admin_order_cancellation", {
    p_order_id: order.id,
    p_reviewer: user.id,
    p_reason: reason,
    p_claim_token: claimToken,
    p_note: decisionNote || null,
    p_refund_id: refundId,
    p_demo: demo,
    p_raw_payload: refundPayload,
  });
  if (finalizeError) return json(request, { error: `The provider refund was accepted, but the CozyCraft ledger could not finalize. Retry safely: ${finalizeError.message}` }, 500);
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
    ledger,
    claim,
    emailSent: emailResult.sent,
    emailError: emailResult.error,
  });
});
