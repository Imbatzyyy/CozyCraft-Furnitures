import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const emptyResponse = (status: number) => new Response(null, {
  status,
  headers: responseHeaders,
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxAvatarBytes = 5 * 1024 * 1024;

function normalizeAvatarPath(value: string) {
  const trimmed = value.trim();
  const publicMarker = "/storage/v1/object/public/avatars/";
  const authenticatedMarker = "/storage/v1/object/authenticated/avatars/";
  if (trimmed.includes(publicMarker)) return trimmed.split(publicMarker)[1] ?? "";
  if (trimmed.includes(authenticatedMarker)) return trimmed.split(authenticatedMarker)[1] ?? "";
  return trimmed;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "HEAD") return emptyResponse(405);

  const reviewId = new URL(request.url).searchParams.get("review_id")?.trim() ?? "";
  if (!uuidPattern.test(reviewId)) return emptyResponse(400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceRoleKey) return emptyResponse(503);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // A public product page may only retrieve the identity image connected to an
  // approved review. Profile rows and arbitrary avatar objects remain private.
  const { data: review, error: reviewError } = await admin
    .from("reviews")
    .select("user_id")
    .eq("id", reviewId)
    .eq("approved", true)
    .maybeSingle();
  if (reviewError) return emptyResponse(500);
  if (!review?.user_id) return emptyResponse(404);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", review.user_id)
    .maybeSingle();
  if (profileError) return emptyResponse(500);
  if (!profile?.avatar_url) return emptyResponse(404);

  const avatarPath = normalizeAvatarPath(String(profile.avatar_url));
  // Customers can edit their own avatar_url field. Enforcing the owner folder
  // prevents a profile from pointing this privileged reader at another user's
  // private object.
  if (
    !avatarPath.startsWith(`${review.user_id}/`) ||
    avatarPath.includes("..") ||
    avatarPath.includes("\\") ||
    avatarPath.includes("\0")
  ) return emptyResponse(404);

  const { data: avatar, error: avatarError } = await admin.storage
    .from("avatars")
    .download(avatarPath);
  if (avatarError || !avatar) return emptyResponse(404);
  if (avatar.size <= 0 || avatar.size > maxAvatarBytes || !avatar.type.startsWith("image/")) {
    return emptyResponse(415);
  }

  const headers = {
    ...responseHeaders,
    "Content-Type": avatar.type,
    "Content-Length": String(avatar.size),
    "Content-Disposition": "inline",
  };
  return new Response(request.method === "HEAD" ? null : avatar, { status: 200, headers });
});
