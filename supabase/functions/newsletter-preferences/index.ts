import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { newsletterOrigin } from "../_shared/newsletter-email.ts";

const redirect = (status: string) =>
  Response.redirect(`${newsletterOrigin}/?newsletter=${encodeURIComponent(status)}#newsletter`, 303);

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405 });
  }
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return redirect("invalid-link");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) return redirect("unavailable");
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "confirm") {
    const now = new Date().toISOString();
    const { data, error } = await admin.from("newsletter_subscribers")
      .update({
        status: "active",
        confirmed_at: now,
        consented_at: now,
        confirmation_token: null,
        unsubscribed_at: null,
      })
      .eq("confirmation_token", token)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) return redirect("unavailable");
    return redirect(data ? "confirmed" : "already-confirmed");
  }

  if (action === "unsubscribe") {
    const now = new Date().toISOString();
    const { error } = await admin.from("newsletter_subscribers")
      .update({ status: "unsubscribed", unsubscribed_at: now })
      .eq("unsubscribe_token", token);
    if (error) return redirect("unavailable");
    if (request.method === "POST") return new Response(null, { status: 204 });
    return redirect("unsubscribed");
  }
  return redirect("invalid-link");
});
