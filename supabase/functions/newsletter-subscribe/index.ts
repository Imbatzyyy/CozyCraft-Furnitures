import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { buildConfirmationEmail } from "../_shared/newsletter-email.ts";

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([
  canonicalOrigin,
  "https://cozycraftfurnitures.com",
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const corsHeaders = (request: Request) => {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : canonicalOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cozycraft-platform",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
};

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });

const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isValidEmail = (email: string) =>
  email.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email) &&
  !email.includes("..") &&
  !email.startsWith(".") &&
  !email.endsWith(".");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, { error: "Method not allowed." }, 405);
  }

  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    return json(request, { error: "This website is not allowed to use the subscription service." }, 403);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 2048) {
    return json(request, { error: "The request is too large." }, 413);
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) {
    return json(request, { error: "Enter a valid email address." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(request, { error: "The subscription service is temporarily unavailable." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: lookupError } = await admin
    .from("newsletter_subscribers")
    .select("id,status,confirmation_token,confirmation_sent_at")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    console.error("newsletter lookup failed", lookupError.code);
    return json(request, { error: "We could not save your subscription just now." }, 500);
  }

  if (existing?.status === "active") {
    return json(request, { status: "already_subscribed" });
  }

  if (
    existing?.status === "pending" &&
    existing.confirmation_sent_at &&
    Date.now() - Date.parse(existing.confirmation_sent_at) < 2 * 60 * 1000
  ) {
    return json(request, { status: "confirmation_sent" });
  }

  const confirmationToken = crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "");
  const unsubscribeToken = crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "");
  const now = new Date().toISOString();
  let subscriberId: number | null = null;

  if (existing) {
    const { data, error } = await admin
      .from("newsletter_subscribers")
      .update({
        status: "pending",
        source: "homepage",
        confirmation_token: confirmationToken,
        unsubscribe_token: unsubscribeToken,
        confirmation_sent_at: now,
        confirmed_at: null,
        unsubscribed_at: null,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) {
      console.error("newsletter re-subscribe failed", error.code);
      return json(request, { error: "We could not save your subscription just now." }, 500);
    }
    subscriberId = Number(data.id);
  } else {
    const { data, error: insertError } = await admin.from("newsletter_subscribers").insert({
      email,
      source: "homepage",
      status: "pending",
      confirmation_token: confirmationToken,
      unsubscribe_token: unsubscribeToken,
      confirmation_sent_at: now,
    }).select("id").single();

    if (insertError?.code === "23505") return json(request, { status: "already_subscribed" });
    if (insertError) {
      console.error("newsletter subscribe failed", insertError.code);
      return json(request, { error: "We could not save your subscription just now." }, 500);
    }
    subscriberId = Number(data.id);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json(request, { error: "Confirmation email is temporarily unavailable." }, 503);
  const confirmUrl = `${supabaseUrl}/functions/v1/newsletter-preferences?action=confirm&token=${confirmationToken}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `newsletter-confirm-${subscriberId}-${confirmationToken.slice(0, 12)}`,
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_MARKETING_FROM") ?? Deno.env.get("RESEND_FROM_EMAIL") ??
        "CozyCraft Furnitures <no-reply@auth.cozycraftfurnitures.com>",
      to: [email],
      reply_to: Deno.env.get("RESEND_REPLY_TO") ?? "cozycraftfurnitures2026@gmail.com",
      subject: "Confirm your CozyCraft updates",
      html: buildConfirmationEmail(confirmUrl),
    }),
  }).catch(() => null);
  if (!response?.ok) {
    console.error("newsletter confirmation failed", response?.status ?? "network");
    await admin.from("newsletter_subscribers")
      .update({ confirmation_sent_at: null })
      .eq("id", subscriberId);
    return json(request, { error: "We saved your request but could not send the confirmation email. Please try again." }, 502);
  }

  return json(request, { status: "confirmation_sent" }, 201);
});
