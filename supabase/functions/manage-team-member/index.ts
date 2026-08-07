import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cozycraft-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json({ error: "Server configuration is incomplete." }, 500);
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
  if (userError || !user) return json({ error: "Invalid session." }, 401);

  const { data: caller } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (caller?.role !== "superadmin") {
    return json({ error: "Super administrator access required." }, 403);
  }

  let payload: TeamRequest;
  try {
    payload = (await request.json()) as TeamRequest;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const allowedRoles: TeamRole[] = ["staff", "admin", "superadmin"];
  if (
    (payload.action === "invite" || payload.action === "update-role") &&
    !allowedRoles.includes(payload.role)
  ) {
    return json({ error: "Invalid team role." }, 400);
  }

  if (payload.action === "invite") {
    const email = payload.email.trim().toLowerCase();
    const fullName = payload.fullName.trim();
    if (!email || !fullName) {
      return json({ error: "Name and email are required." }, 400);
    }

    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      return json(
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
      return json({ error: error?.message ?? "Unable to send invitation." }, 400);
    }

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: payload.role,
      staff_active: true,
    });
    if (profileError) return json({ error: profileError.message }, 400);

    await adminClient.from("activity_logs").insert({
      actor_id: user.id,
      action: "team_member_invited",
      entity_type: "profile",
      entity_id: data.user.id,
      details: { email, role: payload.role },
    });

    return json({ success: true, message: `Invitation sent to ${email}.` });
  }

  if (payload.action === "update-role") {
    if (!payload.userId) return json({ error: "User ID is required." }, 400);
    if (payload.userId === user.id) {
      return json(
        { error: "You cannot change your own superadmin role." },
        400,
      );
    }

    const { data: target } = await adminClient
      .from("profiles")
      .select("role, email")
      .eq("id", payload.userId)
      .single();
    if (!target) return json({ error: "Team member not found." }, 404);

    if (target.role === "superadmin" && payload.role !== "superadmin") {
      const { count } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "superadmin");
      if ((count ?? 0) <= 1) {
        return json(
          { error: "At least one super administrator must remain." },
          400,
        );
      }
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ role: payload.role })
      .eq("id", payload.userId);
    if (error) return json({ error: error.message }, 400);

    await adminClient.from("activity_logs").insert({
      actor_id: user.id,
      action: "team_member_role_changed",
      entity_type: "profile",
      entity_id: payload.userId,
      details: {
        email: target.email,
        from: target.role,
        to: payload.role,
      },
    });

    return json({ success: true, message: "Role updated." });
  }

  if (payload.action === "set-status") {
    if (!payload.userId) return json({ error: "User ID is required." }, 400);
    if (payload.userId === user.id) {
      return json(
        { error: "You cannot suspend your own superadmin account." },
        400,
      );
    }

    const { data: target } = await adminClient
      .from("profiles")
      .select("role, email, staff_active")
      .eq("id", payload.userId)
      .single();
    if (!target || !allowedRoles.includes(target.role as TeamRole)) {
      return json({ error: "Team member not found." }, 404);
    }

    if (target.role === "superadmin" && !payload.active) {
      const { count } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "superadmin")
        .eq("staff_active", true);
      if ((count ?? 0) <= 1) {
        return json(
          { error: "At least one active super administrator must remain." },
          400,
        );
      }
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ staff_active: payload.active })
      .eq("id", payload.userId);
    if (error) return json({ error: error.message }, 400);

    await adminClient.from("activity_logs").insert({
      actor_id: user.id,
      action: payload.active
        ? "team_member_reactivated"
        : "team_member_suspended",
      entity_type: "profile",
      entity_id: payload.userId,
      details: { email: target.email, role: target.role },
    });

    return json({
      success: true,
      message: payload.active
        ? "Team member access restored."
        : "Team member access suspended.",
    });
  }

  return json({ error: "Unsupported action." }, 400);
});
