import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthActivityAction =
  | "customer_sign_in"
  | "customer_sign_out"
  | "admin_sign_in"
  | "admin_sign_out"
  | "admin_idle_logout";

const clientPlatform = () =>
  /(android|iphone|ipad|mobile|capacitor|cordova)/i.test(navigator.userAgent)
    ? "mobile"
    : "web";

/** Audit authentication without ever preventing the actual auth operation. */
export async function recordAuthActivity(
  client: SupabaseClient,
  action: AuthActivityAction,
  details: Record<string, unknown> = {},
) {
  try {
    await client.rpc("record_auth_activity", {
      p_action: action,
      p_platform: clientPlatform(),
      p_details: details,
    });
  } catch {
    // Authentication remains available if audit logging is temporarily offline.
  }
}
