import { describeDevice, sessionIdFromAccessToken } from "@/lib/auth/device-session";
import { supabase } from "@/services/supabase/client";

export type CustomerDeviceSession = {
  session_id: string;
  device_label: string;
  browser_label: string;
  signed_in_at: string;
  last_seen_at: string;
  is_current: boolean;
};

type SessionSyncResult = {
  active: boolean;
  sessionId: string | null;
};

export async function syncCurrentCustomerDevice(): Promise<SessionSyncResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) return { active: false, sessionId: null };

  const sessionId = sessionIdFromAccessToken(session.access_token);
  if (!sessionId) return { active: true, sessionId: null };

  const { browser, device } = describeDevice(window.navigator.userAgent);
  const { data, error } = await supabase.rpc("touch_customer_device_session", {
    p_session_id: sessionId,
    p_device_label: device,
    p_browser_label: browser,
  });
  if (error) {
    // A temporary registry failure must not turn a valid Auth session into a
    // guest session. Protected database policies still enforce known revokes.
    return { active: true, sessionId };
  }
  return { active: data !== false, sessionId };
}

export async function loadCustomerDeviceSessions() {
  const sync = await syncCurrentCustomerDevice();
  if (!sync.active) return { sessions: [], revoked: true, error: null };

  const { data, error } = await supabase.rpc("list_customer_device_sessions");
  return {
    sessions: (data ?? []) as CustomerDeviceSession[],
    revoked: false,
    error,
  };
}

export async function revokeCustomerDeviceSession(sessionId: string) {
  const { data, error } = await supabase.rpc("revoke_customer_device_session", {
    p_session_id: sessionId,
  });
  return { revoked: data === true, error };
}

export async function markOtherCustomerSessionsRevoked() {
  const { data, error } = await supabase.rpc("revoke_other_customer_sessions");
  return { count: Number(data ?? 0), error };
}
