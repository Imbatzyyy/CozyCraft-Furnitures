import { createClient } from "npm:@supabase/supabase-js@2.111.0";

// This check uses the caller's JWT, never the service-role client's identity.
// Existing handlers retain their resource ownership and role-specific checks.
export function serveProtected(handler: (request: Request) => Response | Promise<Response>) {
  Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return handler(request);
    const authorization = request.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    let allowed = false;
    if (authorization && url && key) {
      try {
        const client = createClient(url, key, {
          global: { headers: { Authorization: authorization }, fetch: (input, init) =>
            fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const result = await client.rpc("security_action_allowed");
        allowed = !result.error && result.data === true;
      } catch { /* Fail closed when authorization cannot be established. */ }
    }
    if (!allowed) {
      const preflight = await handler(new Request(request.url, { method: "OPTIONS", headers: request.headers }));
      const headers = new Headers(preflight.headers);
      headers.set("Content-Type", "application/json");
      headers.set("Cache-Control", "no-store");
      return new Response(JSON.stringify({ error: "Please sign in again and complete account verification before continuing." }), { status: 403, headers });
    }
    return handler(request);
  });
}
