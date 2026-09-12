import { useCallback, useEffect, useRef, useState } from "react";
import { sessionStore } from "@/lib/shared/browser-storage";

export type PendingEmail = { owner: string; email: string; expiresAt: number };
export function parsePendingEmail(raw: string | null, owner: string, now = Date.now()): PendingEmail | null {
  try {
    const value = JSON.parse(raw ?? "null") as PendingEmail | null;
    return value && value.owner === owner && typeof value.email === "string" && value.email.includes("@")
      && Number.isFinite(value.expiresAt) && value.expiresAt > now ? value : null;
  } catch { return null; }
}

export function usePendingEmail(userId: string | null, confirm: (email: string) => Promise<{ confirmed: boolean; error: string | null }>, onConfirmed: (email: string) => void) {
  const [pending, setPending] = useState<PendingEmail | null>(null);
  const [message, setMessage] = useState("");
  const key = userId ? `cozycraft-pending-email:${userId}` : null;
  const live = useRef({ userId, pending, confirm, onConfirmed });
  live.current = { userId, pending, confirm, onConfirmed };
  const inFlight = useRef(false);
  const checked = useRef({ key: "", at: 0 });
  const email = pending && pending.owner === userId && pending.expiresAt > Date.now() ? pending.email : null;
  useEffect(() => {
    sessionStore.removeItem("cozycraft-pending-email");
    const value = key && userId ? parsePendingEmail(sessionStore.getItem(key), userId) : null;
    setPending(value); setMessage("");
    if (key && !value) sessionStore.removeItem(key);
  }, [key, userId]);
  const setEmail = useCallback((value: string | null) => {
    if (!key || !userId) return;
    const record = value ? { owner: userId, email: value, expiresAt: Date.now() + 24 * 60 * 60 * 1000 } : null;
    if (record) sessionStore.setItem(key, JSON.stringify(record)); else sessionStore.removeItem(key);
    checked.current = { key: "", at: 0 }; setPending(record); setMessage("");
  }, [key, userId]);
  const check = useCallback(async () => {
    const current = live.current;
    const record = current.pending;
    if (!record || record.owner !== current.userId || inFlight.current || document.visibilityState === "hidden") return;
    if (record.expiresAt <= Date.now()) { setMessage("This email-change check has expired. Request a new verification email."); return; }
    const requestKey = `${record.owner}:${record.email}`;
    if (checked.current.key === requestKey && Date.now() - checked.current.at < 15_000) return;
    checked.current = { key: requestKey, at: Date.now() }; inFlight.current = true;
    const stillCurrent = () => live.current.userId === record.owner && live.current.pending === record;
    try {
      const result = await current.confirm(record.email);
      if (!stillCurrent()) return;
      if (result.error) setMessage(result.error);
      else if (result.confirmed) {
        sessionStore.removeItem(`cozycraft-pending-email:${record.owner}`);
        setPending(null); setMessage(""); live.current.onConfirmed(record.email);
      } else setMessage("Not confirmed yet. Open the verification email, then return here to check again.");
    } catch { if (stillCurrent()) setMessage("We couldn't check your email yet. Reconnect and try again."); }
    finally { inFlight.current = false; }
  }, []);
  useEffect(() => {
    if (!email) return;
    void check();
    const refresh = () => { void check(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [check, email]);
  return { pendingEmail: email, setPendingEmail: setEmail, emailCheckMessage: message, setEmailCheckMessage: setMessage, verifyPendingEmail: check };
}
