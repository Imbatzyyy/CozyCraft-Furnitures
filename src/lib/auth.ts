import { isStaffRole, supabase, type DbRole } from "./supabase";

export type AuthPortal = "customer" | "admin";

export type PortalSignInResult = {
  ok: boolean;
  role: DbRole | null;
  error: string | null;
  reason:
    | "invalid_credentials"
    | "wrong_portal"
    | "profile_unavailable"
    | null;
};

export const roleCanUsePortal = (role: DbRole, portal: AuthPortal) =>
  portal === "customer" ? role === "customer" : isStaffRole(role);

export async function signInForPortal(
  email: string,
  password: string,
  portal: AuthPortal,
): Promise<PortalSignInResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error: authError } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (authError || !data.user) {
    return {
      ok: false,
      role: null,
      reason: "invalid_credentials",
      error: "Incorrect email or password. Please check your credentials.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile?.role) {
    await supabase.auth.signOut();
    return {
      ok: false,
      role: null,
      reason: "profile_unavailable",
      error:
        "Your account access could not be verified. Please try again or contact support.",
    };
  }

  const role = profile.role as DbRole;
  if (!roleCanUsePortal(role, portal)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      role,
      reason: "wrong_portal",
      error:
        portal === "customer"
          ? "This sign-in page accepts customer accounts only."
          : "This account is not approved for administrator access.",
    };
  }

  return { ok: true, role, error: null, reason: null };
}
