import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([canonicalOrigin, "https://cozycraftfurnitures.com", "http://localhost:5173"]);
const cors = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("Origin") ?? "") ? request.headers.get("Origin")! : canonicalOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(request), "Content-Type": "application/json" } });

type Payload =
  | { action: "update"; userId: string; fullName: string; username: string; phone: string; gender: string; dateOfBirth: string | null }
  | { action: "set-status"; userId: string; active: boolean };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(request, { error: "Authentication required." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !anonKey || !serviceKey) return json(request, { error: "Server configuration is incomplete." }, 500);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(request, { error: "Invalid session." }, 401);
  const [{ data: caller }, { data: security }] = await Promise.all([
    userClient.from("profiles").select("role,staff_active").eq("id", user.id).single(),
    admin.from("admin_security_settings").select("require_admin_mfa").eq("id", true).maybeSingle(),
  ]);
  if (!caller?.staff_active || !["admin", "superadmin"].includes(caller.role)) return json(request, { error: "Administrator access required." }, 403);
  const jwtAal = (() => {
    try {
      const encoded = authorization.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
      return String(claims.aal ?? "aal1");
    } catch { return "aal1"; }
  })();
  if ((security?.require_admin_mfa ?? true) && jwtAal !== "aal2") {
    return json(request, { error: "Complete administrator MFA before managing customer accounts." }, 403);
  }
  let payload: Payload;
  try { payload = await request.json() as Payload; } catch { return json(request, { error: "Invalid request body." }, 400); }
  if (!payload.userId) return json(request, { error: "Customer ID is required." }, 400);
  const { data: target } = await admin.from("profiles").select("id,email,role,customer_active").eq("id", payload.userId).maybeSingle();
  if (!target || target.role !== "customer") return json(request, { error: "Customer account not found." }, 404);

  if (payload.action === "update") {
    const fullName = payload.fullName.trim();
    const username = payload.username.trim();
    if (!fullName || username.length < 3) return json(request, { error: "Full name and a username of at least 3 characters are required." }, 400);
    const { error } = await admin.from("profiles").update({
      full_name: fullName, username, phone: payload.phone.trim() || null,
      gender: payload.gender.trim(), date_of_birth: payload.dateOfBirth || null,
    }).eq("id", target.id);
    if (error) return json(request, { error: error.message }, 400);
    await admin.from("activity_logs").insert({ actor_id: user.id, action: "customer_profile_updated", entity_type: "profile", entity_id: target.id, details: { email: target.email } });
    return json(request, { success: true, message: "Customer profile updated." });
  }
  if (payload.action === "set-status") {
    const { error } = await admin.from("profiles").update({ customer_active: payload.active }).eq("id", target.id);
    if (error) return json(request, { error: error.message }, 400);
    await admin.auth.admin.updateUserById(target.id, { ban_duration: payload.active ? "none" : "876000h" });
    await admin.from("activity_logs").insert({ actor_id: user.id, action: payload.active ? "customer_reactivated" : "customer_suspended", entity_type: "profile", entity_id: target.id, details: { email: target.email } });
    return json(request, { success: true, message: payload.active ? "Customer account reactivated." : "Customer account suspended." });
  }
  return json(request, { error: "Unsupported action." }, 400);
});
