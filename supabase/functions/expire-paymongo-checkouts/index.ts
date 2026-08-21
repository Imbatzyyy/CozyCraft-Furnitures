import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { reconcileElapsedPaymongoSession } from "../_shared/paymongo-expiry.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serverApiKey = request.headers.get("apikey")?.trim();
  const paymongoSecretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
  if (!supabaseUrl || !paymongoSecretKey) {
    return json({ error: "Payment expiry worker is not configured." }, 503);
  }

  // This function is intended only for the trusted server-side cron request.
  // Authorize through Postgres rather than comparing raw key strings so both
  // the legacy service-role JWT and current Supabase secret-key format work.
  // The claim RPC is revoked from anon/authenticated and granted only to the
  // service_role, so a browser/public key cannot claim or expire any order.
  if (!serverApiKey) {
    return json({ error: "Unauthorized." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serverApiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimed, error: claimError } = await adminClient.rpc(
    "claim_expired_paymongo_checkouts",
    { p_limit: 10 },
  );
  if (claimError) return json({ error: claimError.message }, 500);

  const results = { claimed: 0, expired: 0, paid: 0, retry: 0 };
  const candidates = (claimed ?? []).filter((candidate: Record<string, unknown>) =>
    typeof candidate?.order_id === "string" &&
    typeof candidate?.transaction_id === "string" &&
    typeof candidate?.provider_session_id === "string"
  );
  results.claimed = candidates.length;

  // The scan is deliberately fixed and small. Parallel reconciliation keeps
  // the cron request below its timeout without continuously polling provider
  // sessions or producing unbounded PayMongo traffic.
  await Promise.all(candidates.map(async (candidate: Record<string, string>) => {
    if (
      typeof candidate?.order_id !== "string" ||
      typeof candidate?.transaction_id !== "string" ||
      typeof candidate?.provider_session_id !== "string"
    ) return;

    const result = await reconcileElapsedPaymongoSession({
      adminClient,
      orderId: candidate.order_id,
      transaction: {
        id: candidate.transaction_id,
        order_id: candidate.order_id,
        provider_session_id: candidate.provider_session_id,
      },
      secretKey: paymongoSecretKey,
    });
    results[result.outcome] += 1;
    if (result.outcome === "retry") {
      console.warn(
        "PayMongo expiry will be retried",
        candidate.order_id,
        result.message,
      );
    }
  }));

  return json(results);
});
