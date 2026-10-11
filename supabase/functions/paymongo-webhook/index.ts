import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const secureEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
};

export async function verifySignature(rawBody: string, header: string, secret: string, live: boolean) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  const timestamp = parts.t;
  // Both fields can be present. Verify the signature for this event's mode.
  const signature = live ? parts.li : parts.te;
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  return secureEqual(hex(digest), signature);
}

export async function handlePaymongoWebhook(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Webhook configuration is incomplete." }, 503);
  }

  if (Number(request.headers.get("content-length")) > 262144) return json({ error: "Payload too large." }, 413);
  const rawBody = await request.text();
  if (rawBody.length > 262144) return json({ error: "Payload too large." }, 413);

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  // PayMongo wraps events in data.attributes. Accept the older flat envelope
  // too, but never use either envelope until its mode-specific HMAC is verified.
  const event = payload?.data?.type === "event" ? payload.data.attributes : payload?.data;
  if (typeof event?.livemode !== "boolean") return json({ error: "Missing event environment." }, 400);
  const signature = request.headers.get("Paymongo-Signature") ?? "";
  if (!(await verifySignature(rawBody, signature, webhookSecret, event.livemode))) {
    return json({ error: "Invalid webhook signature." }, 401);
  }
  if (event?.type !== "checkout_session.payment.paid") {
    return json({ received: true, ignored: true });
  }

  const session = event.data;
  const sessionId = session?.id;
  if (session?.type !== "checkout_session" || typeof sessionId !== "string" || !sessionId) {
    return json({ error: "Missing checkout session." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const transactionQuery = adminClient
    .from("payment_transactions")
    .select("id,order_id,status,amount,currency,livemode,provider_payment_id,orders!inner(order_number,total)")
    .eq("provider", "paymongo")
    .eq("provider_session_id", sessionId);
  const { data: transaction, error: transactionError } = await transactionQuery.maybeSingle();
  if (transactionError) return json({ error: "Payment lookup unavailable; retry delivery." }, 503);
  if (!transaction) return json({ error: "Payment transaction not found." }, 404);

  const order = Array.isArray(transaction.orders) ? transaction.orders[0] : transaction.orders;
  const payments = Array.isArray(session.attributes?.payments) ? session.attributes.payments : [];
  const payment = payments.map((item: any) => item?.data ?? item)
    .find((item: any) => item?.attributes?.status === "paid" && typeof item.id === "string" && item.id);
  const attributes = payment?.attributes;
  const expected = Math.round(Number(transaction.amount) * 100);
  if (!payment || !Number.isSafeInteger(expected) || expected <= 0
    || attributes.amount !== expected || expected !== Math.round(Number(order?.total) * 100)
    || attributes.currency !== transaction.currency || attributes.currency !== "PHP"
    || transaction.livemode !== event.livemode
    || (typeof session.attributes?.livemode === "boolean" && session.attributes.livemode !== event.livemode)
    || (typeof attributes.livemode === "boolean" && attributes.livemode !== event.livemode)
    || (session.attributes?.reference_number && session.attributes.reference_number !== order?.order_number)
    || (transaction.provider_payment_id && transaction.provider_payment_id !== payment.id)) {
    return json({ error: "Payment does not match the reserved order." }, 409);
  }
  const providerPaymentId = payment.id;
  const { data: result, error: settlementError } = await adminClient.rpc(
    "settle_paymongo_order",
    {
      p_order_id: transaction.order_id,
      p_transaction_id: transaction.id,
      p_provider_payment_id: providerPaymentId,
      p_livemode: event.livemode,
      // Store the same canonical shape used by return/expiry reconciliation.
      p_raw_payload: { data: session },
    },
  );
  if (settlementError) return json({ error: "Payment settlement needs retry or administrator review." }, 409);

  return json({ received: true, result });
}

if (import.meta.main) Deno.serve(handlePaymongoWebhook);
