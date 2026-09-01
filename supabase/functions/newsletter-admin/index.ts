import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { buildCampaignEmail } from "../_shared/newsletter-email.ts";

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([canonicalOrigin, "https://cozycraftfurnitures.com", "http://localhost:5173", "http://127.0.0.1:5173"]);
const cors = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("Origin") ?? "") ? request.headers.get("Origin")! : canonicalOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cozycraft-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Vary": "Origin",
});
const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors(request), "Content-Type": "application/json" },
});
const validEmail = (value: unknown) => typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value);
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(request, { error: "Authentication required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !publishableKey || !serviceKey) return json(request, { error: "Newsletter service is not configured." }, 503);
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "Your admin session expired. Sign in again." }, 401);
  const { data: caller } = await admin.from("profiles").select("role,staff_active,email").eq("id", user.id).single();
  if (!caller?.staff_active || !["admin", "superadmin"].includes(caller.role)) {
    return json(request, { error: "Administrator access is required." }, 403);
  }

  const payload = await request.json().catch(() => null);
  const action = payload?.action;
  if (action === "overview") {
    const countStatus = async (status: string) => {
      const { count } = await admin.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", status);
      return count ?? 0;
    };
    const [active, pending, unsubscribed, bounced, campaignResult, productResult] = await Promise.all([
      countStatus("active"), countStatus("pending"), countStatus("unsubscribed"), countStatus("bounced"),
      admin.from("newsletter_campaigns").select("*").order("created_at", { ascending: false }).limit(40),
      admin.from("products").select("id,name,category,subcategory,price,images,main_image_index").eq("status", "active").order("created_at", { ascending: false }).limit(120),
    ]);
    if (campaignResult.error || productResult.error) return json(request, { error: campaignResult.error?.message ?? productResult.error?.message }, 500);
    const products = (productResult.data ?? []).map((product) => ({
      id: product.id, name: product.name, category: product.category, subcategory: product.subcategory,
      price: Number(product.price), image_url: product.images?.[product.main_image_index] ?? product.images?.[0] ?? "",
    }));
    return json(request, { counts: { active, pending, unsubscribed, bounced }, campaigns: campaignResult.data ?? [], products, adminEmail: caller.email ?? user.email ?? "" });
  }

  if (action === "save") {
    const input = payload?.campaign ?? {};
    const id = typeof input.id === "string" ? input.id : null;
    const productIds = Array.isArray(input.product_ids) ? [...new Set(input.product_ids.filter((id: unknown) => typeof id === "string"))].slice(0, 4) : [];
    const campaign = {
      internal_name: text(input.internal_name, 120), subject: text(input.subject, 120),
      preheader: text(input.preheader, 180), heading: text(input.heading, 160), body: text(input.body, 4000),
      cta_label: text(input.cta_label, 60) || "Explore the collection", cta_path: text(input.cta_path, 240) || "/new-arrivals",
      product_ids: productIds,
    };
    if (!campaign.internal_name || !campaign.subject || !campaign.heading || !campaign.body) return json(request, { error: "Campaign name, subject, heading, and message are required." }, 400);
    if (!campaign.cta_path.startsWith("/") || campaign.cta_path.startsWith("//")) return json(request, { error: "Use a safe CozyCraft action path." }, 400);
    const { data: productRows, error: productError } = productIds.length
      ? await admin.from("products").select("id,name,category,price,images,main_image_index").in("id", productIds).eq("status", "active")
      : { data: [], error: null };
    if (productError) return json(request, { error: productError.message }, 500);
    const snapshot = (productRows ?? []).map((product) => ({
      id: product.id, name: product.name, category: product.category, price: Number(product.price),
      image_url: product.images?.[product.main_image_index] ?? product.images?.[0] ?? "",
    }));
    let result;
    if (id) {
      const existing = await admin.from("newsletter_campaigns").select("status").eq("id", id).single();
      if (existing.error || !["draft", "failed"].includes(existing.data.status)) return json(request, { error: "Only draft or failed campaigns can be edited." }, 409);
      result = await admin.from("newsletter_campaigns").update({ ...campaign, product_snapshot: snapshot, status: "draft" }).eq("id", id).select("*").single();
    } else {
      result = await admin.from("newsletter_campaigns").insert({ ...campaign, product_snapshot: snapshot, created_by: user.id }).select("*").single();
    }
    if (result.error) return json(request, { error: result.error.message }, 400);
    return json(request, { campaign: result.data });
  }

  const campaignId = typeof payload?.campaignId === "string" ? payload.campaignId : "";
  if (!campaignId) return json(request, { error: "Campaign is required." }, 400);
  const { data: campaign, error: campaignError } = await admin.from("newsletter_campaigns").select("*").eq("id", campaignId).single();
  if (campaignError || !campaign) return json(request, { error: "Campaign not found." }, 404);

  if (action === "test") {
    const recipient = text(payload?.email, 254).toLowerCase();
    if (!validEmail(recipient)) return json(request, { error: "Enter a valid test email." }, 400);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json(request, { error: "Resend is not configured." }, 503);
    const previewUnsubscribe = `${canonicalOrigin}/privacy`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `newsletter-test-${campaign.id}-${Date.now()}` },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_MARKETING_FROM") ?? Deno.env.get("RESEND_FROM_EMAIL") ?? "CozyCraft Furnitures <no-reply@auth.cozycraftfurnitures.com>",
        to: [recipient], reply_to: Deno.env.get("RESEND_REPLY_TO") ?? "cozycraftfurnitures2026@gmail.com",
        subject: `[Preview] ${campaign.subject}`,
        html: buildCampaignEmail({ ...campaign, products: campaign.product_snapshot ?? [] }, previewUnsubscribe),
      }),
    }).catch(() => null);
    if (!response?.ok) return json(request, { error: "The preview email could not be delivered." }, 502);
    return json(request, { message: `Preview sent to ${recipient}.` });
  }

  if (action === "schedule") {
    if (!["draft", "failed"].includes(campaign.status)) return json(request, { error: "Only draft or failed campaigns can be scheduled." }, 409);
    const requested = typeof payload?.scheduledAt === "string" ? new Date(payload.scheduledAt) : new Date();
    if (Number.isNaN(requested.getTime())) return json(request, { error: "Choose a valid delivery time." }, 400);
    const scheduledAt = requested.getTime() < Date.now() + 15_000 ? new Date().toISOString() : requested.toISOString();
    const { error } = await admin.from("newsletter_campaigns").update({ status: "scheduled", scheduled_at: scheduledAt, worker_locked_at: null }).eq("id", campaign.id);
    if (error) return json(request, { error: error.message }, 400);
    await admin.from("activity_logs").insert({ actor_id: user.id, action: "newsletter_campaign_scheduled", entity_type: "newsletter_campaign", entity_id: campaign.id, details: { internal_name: campaign.internal_name, scheduled_at: scheduledAt }, platform: "web", actor_role: caller.role });
    return json(request, { message: scheduledAt <= new Date(Date.now() + 15_000).toISOString() ? "Campaign queued for delivery." : "Campaign scheduled in Philippine time." });
  }

  if (action === "cancel") {
    if (!["draft", "scheduled", "failed"].includes(campaign.status)) return json(request, { error: "This campaign can no longer be cancelled." }, 409);
    const { error } = await admin.from("newsletter_campaigns").update({ status: "cancelled", scheduled_at: null, worker_locked_at: null }).eq("id", campaign.id);
    if (error) return json(request, { error: error.message }, 400);
    return json(request, { message: "Campaign cancelled." });
  }
  return json(request, { error: "Unsupported newsletter action." }, 400);
});
