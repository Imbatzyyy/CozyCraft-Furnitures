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

async function verifySignature(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.te || parts.li;
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

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Webhook configuration is incomplete." }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("Paymongo-Signature") ?? "";
  if (!(await verifySignature(rawBody, signature, webhookSecret))) {
    return json({ error: "Invalid webhook signature." }, 401);
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const event = payload.data;
  if (event?.type !== "checkout_session.payment.paid") {
    return json({ received: true, ignored: true });
  }

  const session = event.data;
  const sessionId = session?.id;
  const referenceNumber = session?.attributes?.reference_number;
  if (!sessionId && !referenceNumber) return json({ error: "Missing checkout reference." }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let transactionQuery = adminClient
    .from("payment_transactions")
    .select("id,order_id,status,orders!inner(order_number,total)");
  transactionQuery = sessionId
    ? transactionQuery.eq("provider_session_id", sessionId)
    : transactionQuery.eq("orders.order_number", referenceNumber);
  const { data: transaction, error: transactionError } = await transactionQuery.maybeSingle();
  if (transactionError) return json({ error: transactionError.message }, 500);
  if (!transaction) return json({ error: "Payment transaction not found." }, 404);

  const payment = session?.attributes?.payments?.[0];
  const providerPaymentId = payment?.id ?? payment?.data?.id ?? null;
  const { error: updateTransactionError } = await adminClient
    .from("payment_transactions")
    .update({
      status: "paid",
      provider_payment_id: providerPaymentId,
      paid_at: new Date().toISOString(),
      livemode: Boolean(event.livemode ?? session?.attributes?.livemode),
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transaction.id);
  if (updateTransactionError) return json({ error: updateTransactionError.message }, 500);

  const { error: updateOrderError } = await adminClient
    .from("orders")
    .update({ payment_status: "paid", status: "processing" })
    .eq("id", transaction.order_id)
    .eq("payment_status", "pending");
  if (updateOrderError) return json({ error: updateOrderError.message }, 500);

  return json({ received: true });
});

