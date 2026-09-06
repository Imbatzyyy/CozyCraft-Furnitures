import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";

export async function reserveBudget(client: SupabaseClient, key: string, limit: number, seconds: number) {
  const { data, error } = await client.rpc("reserve_security_budget", {
    p_key: key, p_limit: limit, p_seconds: seconds,
  });
  return !error && data === true;
}

// Keyed hashes avoid retaining addresses and make offline enumeration harder.
export async function privateBudgetKey(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const hash = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
