import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([canonicalOrigin, "https://cozycraftfurnitures.com", "capacitor://localhost", "ionic://localhost", "http://localhost", "https://localhost"]);
const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("Origin") ?? "") ? request.headers.get("Origin")! : canonicalOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cozycraft-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });

type TeamRole = "staff" | "admin" | "superadmin";
type TeamRequest =
  | {
      action: "invite";
      email: string;
      fullName: string;
      role: TeamRole;
    }
  | {
      action: "update-role";
      userId: string;
      role: TeamRole;
    }
  | {
      action: "set-status";
      userId: string;
      active: boolean;
    }
  | {
      action: "delete";
      userId: string;
    };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, { error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(request, { error: "Authentication required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json(request, { error: "Server configuration is incomplete." }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "Invalid session." }, 401);

  const [callerResult, securityResult] = await Promise.all([
    userClient
      .from("profiles")
      .select("role,staff_active")
      .eq("id", user.id)
      .single(),
    adminClient
      .from("admin_security_settings")
      .select("require_admin_mfa")
      .eq("id", true)
      .maybeSingle(),
  ]);
  const caller = callerResult.data;
  const security = securityResult.data;
  if (securityResult.error || !security) {
    return json(request, { error: "Administrator security policy is unavailable. Try again shortly." }, 503);
  }
  if (caller?.role !== "superadmin" || !caller.staff_active) {
    return json(request, { error: "Super administrator access required." }, 403);
  }
  const jwtAal = (() => {
    try {
      const encoded = authorization.slice(7).split(".")[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
      return String(JSON.parse(atob(padded)).aal ?? "aal1");
    } catch {
      return "aal1";
    }
  })();
  if ((security.require_admin_mfa ?? true) && jwtAal !== "aal2") {
    return json(request, { error: "Complete administrator MFA before changing team access." }, 403);
  }

  let payload: TeamRequest;
  try {
    payload = (await request.json()) as TeamRequest;
  } catch {
    return json(request, { error: "Invalid request body." }, 400);
  }

  const allowedRoles: TeamRole[] = ["staff", "admin", "superadmin"];
  if (
    (payload.action === "invite" || payload.action === "update-role") &&
    !allowedRoles.includes(payload.role)
  ) {
    return json(request, { error: "Invalid team role." }, 400);
  }

  if (payload.action === "invite") {
    const email = payload.email.trim().toLowerCase();
    const fullName = payload.fullName.trim();
    if (!email || !fullName) {
      return json(request, { error: "Name and email are required." }, 400);
    }

    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      return json(request,
        { error: "An account with this email already exists." },
        409,
      );
    }

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: fullName },
        redirectTo:
          "https://www.cozycraftfurnitures.com/admin/setup-account",
      },
    );
    if (error || !data.user) {
      return json(request, { error: error?.message ?? "Unable to send invitation." }, 400);
    }

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: payload.role,
      staff_active: true,
    });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      return json(request, { error: profileError.message }, 400);
    }

    await adminClient.from("activity_logs").insert({
      actor_id: user.id,
      action: "team_member_invited",
      entity_type: "profile",
      entity_id: data.user.id,
      details: { email, role: payload.role },
    });

    return json(request, { success: true, message: `Invitation sent to ${email}.` });
  }

  if (payload.action === "update-role") {
    if (!payload.userId) return json(request, { error: "User ID is required." }, 400);
    if (payload.userId === user.id) {
      return json(request,
        { error: "You cannot change your own superadmin role." },
        400,
      );
    }

    const { data, error } = await adminClient.rpc("mutate_team_member", {
      p_actor_id: user.id,
      p_target_id: payload.userId,
      p_action: "update-role",
      p_role: payload.role,
      p_active: null,
    });
    if (error) return json(request, { error: error.message }, 400);
    return json(request, data ?? { success: true, message: "Role updated." });
  }

  if (payload.action === "set-status") {
    if (!payload.userId) return json(request, { error: "User ID is required." }, 400);
    if (typeof payload.active !== "boolean") return json(request, { error: "Active status is required." }, 400);
    if (payload.userId === user.id) {
      return json(request,
        { error: "You cannot suspend your own superadmin account." },
        400,
      );
    }

    const { data, error } = await adminClient.rpc("mutate_team_member", {
      p_actor_id: user.id,
      p_target_id: payload.userId,
      p_action: "set-status",
      p_role: null,
      p_active: payload.active,
    });
    if (error) return json(request, { error: error.message }, 400);
    return json(request, data ?? {
      success: true,
      message: payload.active ? "Team member access restored." : "Team member access suspended.",
    });
  }

  if (payload.action === "delete") {
    if (!payload.userId) return json(request, { error: "User ID is required." }, 400);
    if (payload.userId === user.id) return json(request, { error: "You cannot permanently delete your own account." }, 400);
    const { data: target } = await adminClient.from("profiles").select("role,email,full_name,staff_active").eq("id", payload.userId).maybeSingle();
    if (!target || !allowedRoles.includes(target.role as TeamRole)) return json(request, { error: "Team member not found." }, 404);
    if (target.role === "superadmin" && target.staff_active) {
      const { count } = await adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "superadmin").eq("staff_active", true);
      if ((count ?? 0) <= 1) return json(request, { error: "At least one active super administrator must remain." }, 400);
    }
    await adminClient.from("activity_logs").insert({ actor_id: user.id, action: "team_member_permanently_deleted", entity_type: "profile", entity_id: payload.userId, details: { email: target.email, name: target.full_name, role: target.role } });
    const { error } = await adminClient.auth.admin.deleteUser(payload.userId, false);
    if (error) return json(request, { error: error.message }, 400);
    return json(request, { success: true, message: "Team account permanently deleted." });
  }

  return json(request, { error: "Unsupported action." }, 400);
});
