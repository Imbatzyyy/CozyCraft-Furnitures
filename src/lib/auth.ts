import {
  adminSupabase,
  isStaffRole,
  supabase,
  type DbRole,
} from "./supabase";

export type AuthPortal = "customer" | "admin";

export type PortalSignInResult = {
  ok: boolean;
  role: DbRole | null;
  error: string | null;
  reason:
    | "invalid_credentials"
    | "wrong_portal"
    | "suspended"
    | "profile_unavailable"
    | null;
};

export const roleCanUsePortal = (role: DbRole, portal: AuthPortal) =>
  portal === "customer" ? role === "customer" : isStaffRole(role);

type SignUpResultLike = {
  data: {
    user: {
      identities?: unknown[] | null;
    } | null;
  };
  error: {
    code?: string;
    message?: string;
  } | null;
};

/**
 * When email confirmation is enabled, Supabase may deliberately return a
 * successful-looking signup response for an existing email to limit account
 * enumeration. That response contains a user with no identities. Supabase can
 * also return an explicit duplicate-account error, depending on Auth settings.
 */
export const isExistingAccountSignUpResult = (result: SignUpResultLike) => {
  const errorCode = result.error?.code?.toLowerCase();
  const errorMessage = result.error?.message?.toLowerCase() ?? "";
  const identities = result.data.user?.identities;

  return (
    errorCode === "user_already_exists" ||
    errorMessage.includes("already registered") ||
    errorMessage.includes("already exists") ||
    (Array.isArray(identities) && identities.length === 0)
  );
};

export async function signInForPortal(
  email: string,
  password: string,
  portal: AuthPortal,
): Promise<PortalSignInResult> {
  const authClient = portal === "admin" ? adminSupabase : supabase;
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error: authError } =
    await authClient.auth.signInWithPassword({
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

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role,staff_active")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile?.role) {
    await authClient.auth.signOut({ scope: "local" });
    return {
      ok: false,
      role: null,
      reason: "profile_unavailable",
      error:
        "Your account access could not be verified. Please try again or contact support.",
    };
  }

  const role = profile.role as DbRole;
  if (isStaffRole(role) && profile.staff_active === false) {
    await authClient.auth.signOut({ scope: "local" });
    return {
      ok: false,
      role,
      reason: "suspended",
      error:
        "This administrator account is suspended. Ask the super administrator to restore access.",
    };
  }
  if (!roleCanUsePortal(role, portal)) {
    await authClient.auth.signOut({ scope: "local" });
    return {
      ok: false,
      role,
      reason: "wrong_portal",
      error:
        portal === "customer"
          ? "Incorrect email or password. Please check your credentials."
          : "This account is not approved for administrator access.",
    };
  }

  return { ok: true, role, error: null, reason: null };
}
