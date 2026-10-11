import type { SupabaseClient } from "@supabase/supabase-js";

export function scrubDiagnostic(value: string) {
  return value
    .replace(/https?:\/\/[^\s)]+/g, (url) => { try { const parsed = new URL(url); return `${parsed.origin}${parsed.pathname}`; } catch { return "[url]"; } })
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[token]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\b(?:password|otp|token|secret|api[_ -]?key)\s*[:=]\s*\S+/gi, "[credential]")
    .replace(/\b\d{6,}\b/g, "[number]");
}

/** Execute the lazy PostgREST request; never block recovery or leak query tokens. */
export async function reportClientError(client: SupabaseClient, error: unknown, context: string, path: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const result = await client.rpc("report_client_error", {
      p_message: scrubDiagnostic(error instanceof Error ? error.message : "Unexpected application error").slice(0, 500),
      p_stack: scrubDiagnostic(error instanceof Error ? error.stack ?? "" : "").slice(0, 4000),
      p_path: path.split(/[?#]/)[0].slice(0, 200),
      p_context: context.slice(0, 60),
      p_user_agent: typeof navigator === "undefined" ? "" : navigator.userAgent.slice(0, 300),
    }).abortSignal(controller.signal);
    return !result.error;
  } catch {
    return false; // Recovery must work even when diagnostics are unavailable.
  } finally {
    clearTimeout(timer);
  }
}
