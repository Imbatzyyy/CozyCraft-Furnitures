import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers });
  const params = new URL(request.url).searchParams;
  const id = params.get("review_id") ?? "";
  const index = Number(params.get("index") ?? "-1");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(index) || index < 0 || index > 2)
    return new Response(null, { status: 400, headers });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from("reviews").select("user_id,image_paths")
    .eq("id", id).eq("approved", true).maybeSingle();
  const value = data?.image_paths?.[index];
  if (error || !data || typeof value !== "string") return new Response(null, { status: 404, headers });
  const marker = "/storage/v1/object/public/review-images/";
  let path: string;
  try { path = decodeURIComponent(value.includes(marker) ? value.split(marker)[1].split("?")[0] : value); }
  catch { return new Response(null, { status: 400, headers }); }
  if (!path.startsWith(`${data.user_id}/`) || /\.\.|\\|\0/.test(path))
    return new Response(null, { status: 404, headers });
  // A redirect avoids proxying image bytes through the function. Visibility is
  // rechecked on each new request; already-issued links expire in one minute.
  const signed = await client.storage.from("review-images").createSignedUrl(path, 60);
  if (signed.error || !signed.data?.signedUrl) return new Response(null, { status: 404, headers });
  return new Response(null, { status: 302, headers: { ...headers, Location: signed.data.signedUrl } });
});
