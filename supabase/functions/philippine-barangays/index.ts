import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import barangays from "npm:@jobuntux/psgc@0.2.1/data/2025-2Q/barangays.json" with { type: "json" };

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([canonicalOrigin, "https://cozycraftfurnitures.com"]);
const headers = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("Origin") ?? "") ? request.headers.get("Origin")! : canonicalOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "public, max-age=86400",
  "Vary": "Origin",
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(request) });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: { ...headers(request), "Content-Type": "application/json" } });
  const body = await request.json().catch(() => ({}));
  const municipalityCode = typeof body.municipalityCode === "string" ? body.municipalityCode.trim() : "";
  if (!/^\d{5}$/.test(municipalityCode)) return new Response(JSON.stringify({ error: "Invalid municipality code." }), { status: 400, headers: { ...headers(request), "Content-Type": "application/json" } });
  const matches = (barangays as Array<{ munCityCode: string; brgyCode: string; brgyName: string }>)
    .filter((item) => item.munCityCode === municipalityCode)
    .sort((a, b) => a.brgyName.localeCompare(b.brgyName));
  return new Response(JSON.stringify({ barangays: matches }), { headers: { ...headers(request), "Content-Type": "application/json" } });
});
