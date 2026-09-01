import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { buildCampaignEmail } from "../_shared/newsletter-email.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const chunks = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serverKey = request.headers.get("apikey")?.trim();
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !serverKey || !resendKey) return json({ error: "Newsletter worker is not configured." }, 503);
  const admin = createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: campaignId, error: claimError } = await admin.rpc("claim_newsletter_campaign");
  if (claimError) return json({ error: claimError.message }, 401);
  if (!campaignId) return json({ claimed: 0, sent: 0, failed: 0 });
  const { data: campaign, error: campaignError } = await admin.from("newsletter_campaigns").select("*").eq("id", campaignId).single();
  if (campaignError || !campaign) return json({ error: "Claimed campaign unavailable." }, 500);

  if (!campaign.recipient_count) {
    const subscribers: Array<{ id: number }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("newsletter_subscribers").select("id").eq("status", "active").range(from, from + 999);
      if (error) return json({ error: error.message }, 500);
      subscribers.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    for (const batch of chunks(subscribers, 500)) {
      const { error } = await admin.from("newsletter_deliveries").upsert(
        batch.map((subscriber) => ({ campaign_id: campaign.id, subscriber_id: subscriber.id })),
        { onConflict: "campaign_id,subscriber_id", ignoreDuplicates: true },
      );
      if (error) return json({ error: error.message }, 500);
    }
    await admin.from("newsletter_campaigns").update({ recipient_count: subscribers.length }).eq("id", campaign.id);
  }

  const { data: candidates, error: deliveryError } = await admin.from("newsletter_deliveries")
    .select("id,subscriber_id,status,attempt_count,newsletter_subscribers!inner(email,unsubscribe_token,status)")
    .eq("campaign_id", campaign.id)
    .in("status", ["queued", "failed"])
    .lt("attempt_count", 3)
    .eq("newsletter_subscribers.status", "active")
    .order("created_at")
    .limit(50);
  if (deliveryError) return json({ error: deliveryError.message }, 500);
  const claimed = candidates ?? [];
  if (claimed.length) {
    await admin.from("newsletter_deliveries").update({ status: "sending" }).in("id", claimed.map((item) => item.id));
  }

  let sent = 0;
  let failed = 0;
  for (const batch of chunks(claimed, 8)) {
    await Promise.all(batch.map(async (delivery) => {
      const subscriber = Array.isArray(delivery.newsletter_subscribers) ? delivery.newsletter_subscribers[0] : delivery.newsletter_subscribers;
      if (!subscriber?.email || !subscriber?.unsubscribe_token) {
        failed += 1;
        await admin.from("newsletter_deliveries").update({ status: "failed", attempt_count: delivery.attempt_count + 1, error_message: "Subscriber preferences unavailable." }).eq("id", delivery.id);
        return;
      }
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/newsletter-preferences?action=unsubscribe&token=${subscriber.unsubscribe_token}`;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `newsletter-delivery-${delivery.id}` },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_MARKETING_FROM") ?? Deno.env.get("RESEND_FROM_EMAIL") ?? "CozyCraft Furnitures <no-reply@auth.cozycraftfurnitures.com>",
          to: [subscriber.email], reply_to: Deno.env.get("RESEND_REPLY_TO") ?? "cozycraftfurnitures2026@gmail.com",
          subject: campaign.subject,
          html: buildCampaignEmail({ ...campaign, products: campaign.product_snapshot ?? [] }, unsubscribeUrl),
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
      }).catch(() => null);
      const payload = response ? await response.json().catch(() => ({})) : {};
      if (response?.ok) {
        sent += 1;
        await Promise.all([
          admin.from("newsletter_deliveries").update({ status: "sent", attempt_count: delivery.attempt_count + 1, provider_message_id: payload.id ?? null, error_message: null, sent_at: new Date().toISOString() }).eq("id", delivery.id),
          admin.from("newsletter_subscribers").update({ last_delivery_at: new Date().toISOString() }).eq("id", delivery.subscriber_id),
        ]);
      } else {
        failed += 1;
        await admin.from("newsletter_deliveries").update({ status: "failed", attempt_count: delivery.attempt_count + 1, error_message: `Provider status ${response?.status ?? "network"}` }).eq("id", delivery.id);
      }
    }));
  }

  const [sentResult, failedResult, queuedResult, retryResult] = await Promise.all([
    admin.from("newsletter_deliveries").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "sent"),
    admin.from("newsletter_deliveries").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "failed"),
    admin.from("newsletter_deliveries").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).in("status", ["queued", "sending"]),
    admin.from("newsletter_deliveries").select("id").eq("campaign_id", campaign.id).eq("status", "failed").lt("attempt_count", 3).limit(1),
  ]);
  const complete = (queuedResult.count ?? 0) === 0 && (retryResult.data?.length ?? 0) === 0;
  await admin.from("newsletter_campaigns").update({
    sent_count: sentResult.count ?? 0, failed_count: failedResult.count ?? 0,
    status: complete ? ((sentResult.count ?? 0) > 0 || campaign.recipient_count === 0 ? "sent" : "failed") : "sending",
    sent_at: complete ? new Date().toISOString() : null,
    worker_locked_at: null,
  }).eq("id", campaign.id);
  return json({ claimed: 1, campaignId: campaign.id, sent, failed, complete });
});
