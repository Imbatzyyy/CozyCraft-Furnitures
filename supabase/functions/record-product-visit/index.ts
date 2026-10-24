import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { privateBudgetKey } from "../_shared/abuse-budget.ts";

const origins = new Set([
  "https://www.cozycraftfurnitures.com", "https://cozycraftfurnitures.com",
  "http://localhost:5173", "http://127.0.0.1:5173",
]);

export async function handleProductVisit(request: Request): Promise<Response> {
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "Access-Control-Allow-Origin": origins.has(origin) ? origin : "https://www.cozycraftfurnitures.com",
    "Access-Control-Allow-Headers": "content-type,apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400", "Cache-Control": "no-store", "Vary": "Origin",
  };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...headers, "Content-Type": "application/json" },
  });
  if (!origins.has(origin)) return reply({ accepted: false }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ accepted: false }, 405);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ accepted: false }, 415);
  if (Number(request.headers.get("content-length")) > 1024) return reply({ accepted: false }, 413);
  try {
    // Bound streamed bodies as well as declared Content-Length.
    const reader = request.body?.getReader();
    let raw = "", bytes = 0;
    const decoder = new TextDecoder();
    if (reader) while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1024) { await reader.cancel(); return reply({ accepted: false }, 413); }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ accepted: false }, 400); }
    const { productId, eventId } = body ?? {};
    if (typeof productId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(productId)
      || typeof eventId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
      return reply({ accepted: false }, 400);
    }
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply({ accepted: false }, 503);
    // A keyed, non-reversible network budget; never store the raw address.
    // The global ceiling also protects against missing/spoofed network headers.
    const ip = (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0,128);
    const source = await privateBudgetKey(`catalog-visit:${ip}`, key);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.rpc("record_catalog_visit", {
      p_product: productId, p_event: eventId, p_source: source,
    }).abortSignal(AbortSignal.timeout(4000));
    if (error) return reply({ accepted: false }, 503);
    return reply({ accepted: data?.accepted === true, ...(data?.accepted === true ? { visits: data.visits } : {}) });
  } catch { return reply({ accepted: false }, 503); }
}

if (import.meta.main) Deno.serve(handleProductVisit);
