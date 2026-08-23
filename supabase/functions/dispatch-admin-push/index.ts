import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

type PushRecord = {
  id: number;
  kind: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  route?: string | null;
};

type Device = { id: string; user_id: string; token: string; platform: string };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const base64Url = (value: Uint8Array | string) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const pemBytes = (pem: string) => {
  const value = atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
};

let googleAccess: { token: string; expiresAt: number } | null = null;
const googleAccessToken = async () => {
  if (googleAccess && googleAccess.expiresAt > Date.now() + 60_000) return googleAccess.token;
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Firebase service account is not configured");
  const account = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string };
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(String(result.error_description ?? "Firebase authorization failed"));
  googleAccess = { token: String(result.access_token), expiresAt: Date.now() + Number(result.expires_in ?? 3600) * 1000 };
  return googleAccess.token;
};

let appleAccess: { token: string; expiresAt: number } | null = null;
const appleAccessToken = async () => {
  if (appleAccess && appleAccess.expiresAt > Date.now() + 60_000) return appleAccess.token;
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");
  if (!keyId || !teamId || !privateKey) throw new Error("Apple push credentials are not configured");
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "ES256", kid: keyId }))}.${base64Url(JSON.stringify({ iss: teamId, iat: issuedAt }))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  appleAccess = { token: `${unsigned}.${base64Url(new Uint8Array(signature))}`, expiresAt: Date.now() + 50 * 60_000 };
  return appleAccess.token;
};

const dataPayload = (notification: PushRecord) => ({
  notification_id: String(notification.id),
  kind: notification.kind,
  entity_type: notification.entity_type ?? "",
  entity_id: notification.entity_id ?? "",
  route: notification.route ?? "/app/notifications",
});

const androidChannel = (notification: PushRecord) =>
  notification.kind === "order" ? "cozycraft_orders" : "cozycraft_operations";

const notificationGroup = (notification: PushRecord) =>
  `cozycraft-admin-${notification.kind || "system"}`;

const notificationTag = (notification: PushRecord) =>
  `cozycraft-${notification.kind}-${notification.entity_id || notification.id}`.slice(0, 64);

const sendAndroid = async (device: Device, notification: PushRecord) => {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) return { sent: false, invalid: false, reason: "firebase_not_configured" };
  const project = (JSON.parse(raw) as { project_id: string }).project_id;
  const token = await googleAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token: device.token,
      notification: { title: notification.title, body: notification.message },
      data: dataPayload(notification),
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channel_id: androidChannel(notification),
          icon: "ic_stat_cozycraft",
          color: "#B8A58D",
          tag: notificationTag(notification),
        },
      },
    } }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.text();
  return {
    sent: response.ok,
    invalid: response.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(body),
    reason: response.ok ? null : body.slice(0, 300),
  };
};

const sendIos = async (device: Device, notification: PushRecord) => {
  const topic = Deno.env.get("APNS_BUNDLE_ID");
  if (!topic || !Deno.env.get("APNS_PRIVATE_KEY")) return { sent: false, invalid: false, reason: "apns_not_configured" };
  const token = await appleAccessToken();
  const production = (Deno.env.get("APNS_PRODUCTION") ?? "true").toLowerCase() !== "false";
  const host = production ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const response = await fetch(`https://${host}/3/device/${encodeURIComponent(device.token)}`, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: notification.title, body: notification.message },
        sound: "default",
        "thread-id": notificationGroup(notification),
        "interruption-level": notification.kind === "order" ? "time-sensitive" : "active",
        "relevance-score": notification.kind === "order" ? 1 : 0.75,
      },
      ...dataPayload(notification),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.text();
  return {
    sent: response.ok,
    invalid: response.status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/i.test(body),
    reason: response.ok ? null : body.slice(0, 300),
  };
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const webhookSecret = Deno.env.get("ADMIN_PUSH_WEBHOOK_SECRET");
  if (!webhookSecret || request.headers.get("x-cozycraft-webhook-secret") !== webhookSecret) {
    return json({ error: "Webhook authentication failed" }, 401);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !serviceKey) return json({ error: "Push dispatcher is not configured" }, 503);
  const body = await request.json().catch(() => ({}));
  const notification = (body.record ?? body.notification ?? body) as PushRecord;
  if (!notification?.id || !notification.title || !notification.message || !notification.kind) {
    return json({ error: "An admin notification record is required" }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["staff", "admin", "superadmin"])
    .eq("staff_active", true);
  if (profileError) return json({ error: profileError.message }, 500);
  const audience = (profiles ?? []).map((profile) => profile.id);
  if (!audience.length) return json({ sent: 0, failed: 0, disabled: 0 });
  const { data: devices, error: tokenError } = await admin
    .from("mobile_push_tokens")
    .select("id,user_id,token,platform")
    .eq("active", true)
    .in("user_id", audience);
  if (tokenError) return json({ error: tokenError.message }, 500);

  let sent = 0;
  let failed = 0;
  const invalidIds: string[] = [];
  await Promise.all((devices as Device[] ?? []).map(async (device) => {
    try {
      const result = device.platform === "ios"
        ? await sendIos(device, notification)
        : await sendAndroid(device, notification);
      if (result.sent) sent += 1;
      else failed += 1;
      if (result.invalid) invalidIds.push(device.id);
    } catch {
      failed += 1;
    }
  }));
  if (invalidIds.length) await admin.from("mobile_push_tokens").update({ active: false }).in("id", invalidIds);
  return json({ notificationId: notification.id, sent, failed, disabled: invalidIds.length, audience: devices?.length ?? 0 });
});
