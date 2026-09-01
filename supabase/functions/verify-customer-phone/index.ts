import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const canonicalOrigin = "https://www.cozycraftfurnitures.com";
const allowedOrigins = new Set([
  canonicalOrigin,
  "https://cozycraftfurnitures.com",
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const corsHeaders = (request: Request) => {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : canonicalOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cozycraft-platform",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
};

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });

const normalizePhone = (value: unknown) => {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`;
  if (/^639\d{9}$/.test(compact)) return `+${compact}`;
  if (/^\+639\d{9}$/.test(compact)) return compact;
  return null;
};

const maskPhone = (phone: string) => `${phone.slice(0, 5)}•••${phone.slice(-4)}`;

const randomOtp = () => {
  const maximum = 0x1_0000_0000;
  const acceptedMaximum = maximum - (maximum % 1_000_000);
  const sample = new Uint32Array(1);
  do crypto.getRandomValues(sample); while (sample[0] >= acceptedMaximum);
  return String(sample[0] % 1_000_000).padStart(6, "0");
};

const digestOtp = async (
  secret: string,
  challengeId: string,
  userId: string,
  phone: string,
  code: string,
) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${challengeId}.${userId}.${phone}.${code}`),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};

const safeEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
};

type RequestPayload =
  | { action: "request"; phone?: string }
  | { action: "verify"; challengeId?: string; code?: string };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, { error: "Method not allowed." }, 405);
  }

  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    return json(request, { error: "This website is not allowed to use phone verification." }, 403);
  }
  if (Number(request.headers.get("Content-Length") ?? 0) > 2048) {
    return json(request, { error: "The request is too large." }, 413);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(request, { error: "Please sign in first." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  const otpHashSecret = Deno.env.get("OTP_HASH_SECRET");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !otpHashSecret) {
    console.error("phone verification server configuration is incomplete");
    return json(request, { error: "Phone verification is temporarily unavailable." }, 503);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "Your session has expired. Please sign in again." }, 401);

  const payload = await request.json().catch(() => null) as RequestPayload | null;
  if (!payload || !["request", "verify"].includes(payload.action)) {
    return json(request, { error: "Invalid verification request." }, 400);
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,phone,phone_verified_at,role,customer_active")
    .eq("id", user.id)
    .single();
  if (profileError || !profile || profile.role !== "customer" || profile.customer_active === false) {
    return json(request, { error: "An active customer account is required." }, 403);
  }

  if (payload.action === "request") {
    const phone = normalizePhone(payload.phone);
    if (!phone) {
      return json(request, { error: "Enter a valid Philippine mobile number, such as 0917 123 4567." }, 400);
    }
    if (profile.phone === phone && profile.phone_verified_at) {
      return json(request, { status: "already_verified", phone, maskedPhone: maskPhone(phone) });
    }

    // Reject an already-owned verified number before purchasing an SMS. This
    // query uses the partial unique index on verified profile phones. The same
    // unique index is checked again atomically when verification completes, so
    // concurrent requests cannot claim one number for two accounts.
    const { data: verifiedOwner, error: ownerLookupError } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .not("phone_verified_at", "is", null)
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();
    if (ownerLookupError) {
      return json(request, { error: "Phone verification could not start." }, 500);
    }
    if (verifiedOwner) {
      return json(request, {
        error: "This mobile number is already verified on another CozyCraft account. Use a different number or contact CozyCraft Care.",
      }, 409);
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentError } = await admin
      .from("phone_verification_challenges")
      .select("id,created_at,status")
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(6);
    if (recentError) return json(request, { error: "Phone verification could not start." }, 500);
    const latestSent = recent?.find((item) => item.status === "sent" || item.status === "pending");
    if (latestSent) {
      const retryAfter = Math.ceil(60 - (Date.now() - Date.parse(latestSent.created_at)) / 1000);
      if (retryAfter > 0) {
        return json(request, { error: `Please wait ${retryAfter} seconds before requesting another code.`, retryAfter }, 429);
      }
    }
    if ((recent?.length ?? 0) >= 5) {
      return json(request, { error: "Too many verification codes were requested. Please try again in one hour." }, 429);
    }
    const { count: phoneRequestCount } = await admin
      .from("phone_verification_challenges")
      .select("id", { count: "exact", head: true })
      .eq("phone_e164", phone)
      .gte("created_at", oneHourAgo);
    if ((phoneRequestCount ?? 0) >= 5) {
      return json(request, { error: "Too many verification codes were requested for this number. Please try again in one hour." }, 429);
    }

    const challengeId = crypto.randomUUID();
    const code = randomOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const codeDigest = await digestOtp(otpHashSecret, challengeId, user.id, phone, code);
    const { error: insertError } = await admin.from("phone_verification_challenges").insert({
      id: challengeId,
      user_id: user.id,
      phone_e164: phone,
      code_digest: codeDigest,
      status: "pending",
      expires_at: expiresAt,
    });
    if (insertError) return json(request, { error: "Phone verification could not start." }, 500);

    const apiSecret = Deno.env.get("UNISMS_API_SECRET");
    const senderId = Deno.env.get("UNISMS_SENDER_ID");
    if (!apiSecret || !senderId) {
      await admin.from("phone_verification_challenges")
        .update({ status: "failed", last_error_code: "provider_not_configured" })
        .eq("id", challengeId);
      return json(request, { error: "SMS verification is being configured. Please try again shortly." }, 503);
    }

    const providerResponse = await fetch("https://unismsapi.com/api/sms", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Basic ${btoa(`${apiSecret}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: phone,
        sender_id: senderId,
        content: `Your CozyCraft verification code is ${code}. It expires in 5 minutes. Do not share this code.`,
        metadata: { template: "customer_phone_verification", challenge_id: challengeId },
      }),
    }).catch(() => null);
    const providerBody = await providerResponse?.json().catch(() => null);
    const providerReference = typeof providerBody?.message?.reference_id === "string"
      ? providerBody.message.reference_id
      : null;
    if (!providerResponse?.ok || !providerReference) {
      console.error("UniSMS send failed", providerResponse?.status ?? "network");
      await admin.from("phone_verification_challenges").update({
        status: "failed",
        last_error_code: providerResponse ? `http_${providerResponse.status}` : "network",
      }).eq("id", challengeId);
      return json(request, { error: "The verification message could not be sent. Check the number and try again." }, 502);
    }

    await admin.from("phone_verification_challenges").update({
      status: "sent",
      provider_reference: providerReference,
    }).eq("id", challengeId);
    return json(request, {
      status: "code_sent",
      challengeId,
      expiresAt,
      resendAfter: 60,
      maskedPhone: maskPhone(phone),
    }, 201);
  }

  const challengeId = typeof payload.challengeId === "string" ? payload.challengeId.trim() : "";
  const code = typeof payload.code === "string" ? payload.code.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
    return json(request, { error: "Enter the complete six-digit verification code." }, 400);
  }
  const { data: challenge, error: challengeError } = await admin
    .from("phone_verification_challenges")
    .select("id,user_id,phone_e164,code_digest,status,attempts,expires_at,created_at")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (challengeError || !challenge) {
    return json(request, { error: "This verification code is no longer valid. Request a new one." }, 400);
  }
  if (challenge.status !== "sent" || challenge.attempts >= 5) {
    return json(request, { error: "This verification code can no longer be used. Request a new one." }, 400);
  }
  const { data: latestChallenge, error: latestChallengeError } = await admin
    .from("phone_verification_challenges")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "sent"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestChallengeError) {
    return json(request, { error: "The verification code could not be checked." }, 500);
  }
  if (!latestChallenge || latestChallenge.id !== challenge.id) {
    return json(request, { error: "A newer verification code was requested. Enter the latest code instead." }, 400);
  }
  if (Date.parse(challenge.expires_at) <= Date.now()) {
    await admin.from("phone_verification_challenges").update({ status: "expired" }).eq("id", challenge.id);
    return json(request, { error: "The verification code expired. Request a new one." }, 400);
  }

  const submittedDigest = await digestOtp(
    otpHashSecret,
    challenge.id,
    user.id,
    challenge.phone_e164,
    code,
  );
  if (!safeEqual(challenge.code_digest, submittedDigest)) {
    const attempts = challenge.attempts + 1;
    await admin.from("phone_verification_challenges").update({
      attempts,
      status: attempts >= 5 ? "locked" : "sent",
    }).eq("id", challenge.id);
    return json(request, {
      error: attempts >= 5
        ? "Too many incorrect attempts. Request a new verification code."
        : `That code is incorrect. ${5 - attempts} attempt${5 - attempts === 1 ? "" : "s"} remaining.`,
      attemptsRemaining: Math.max(0, 5 - attempts),
    }, 400);
  }

  const verifiedAt = new Date().toISOString();
  const phoneWasChanged = Boolean(
    profile.phone_verified_at && profile.phone && profile.phone !== challenge.phone_e164,
  );
  const { error: updateError } = await admin.from("profiles").update({
    phone: challenge.phone_e164,
    phone_verified_at: verifiedAt,
  }).eq("id", user.id);
  if (updateError?.code === "23505") {
    return json(request, { error: "This mobile number is already verified on another CozyCraft account." }, 409);
  }
  if (updateError) return json(request, { error: "The verified number could not be saved." }, 500);

  await Promise.all([
    admin.from("phone_verification_challenges").update({
      status: "verified",
      verified_at: verifiedAt,
    }).eq("id", challenge.id),
    admin.from("phone_verification_challenges").update({ status: "expired" })
      .eq("user_id", user.id)
      .neq("id", challenge.id)
      .in("status", ["pending", "sent"]),
    admin.from("activity_logs").insert({
      actor_id: user.id,
      action: phoneWasChanged ? "customer_phone_changed" : "customer_phone_verified",
      entity_type: "profile",
      entity_id: user.id,
      details: {
        phone_masked: maskPhone(challenge.phone_e164),
        previous_phone_masked: phoneWasChanged && profile.phone ? maskPhone(profile.phone) : null,
        provider: "unisms",
      },
    }),
  ]);

  return json(request, {
    status: "verified",
    phone: challenge.phone_e164,
    phoneVerifiedAt: verifiedAt,
  });
});
