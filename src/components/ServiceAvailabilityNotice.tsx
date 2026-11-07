import { useEffect, useState, useSyncExternalStore } from "react";
import { getServiceHealth, SERVICE_HEALTH_EVENT } from "@/lib/shared/service-health";

const subscribe = (changed: () => void) => {
  window.addEventListener(SERVICE_HEALTH_EVENT, changed);
  return () => window.removeEventListener(SERVICE_HEALTH_EVENT, changed);
};
export const useServiceHealth = () => useSyncExternalStore(subscribe, getServiceHealth, () => null);

export function ServiceAvailabilityNotice({ admin = false }: { admin?: boolean }) {
  const health = useServiceHealth();
  const [now, setNow] = useState(Date.now);
  const [retryPending, setRetryPending] = useState(false);
  useEffect(() => {
    if (!retryPending) return;
    // Unlock the control even when no mounted page has a recovery listener.
    const timer = setTimeout(() => setRetryPending(false), 15_000);
    return () => clearTimeout(timer);
  }, [retryPending]);
  useEffect(() => {
    if (!health) return;
    setNow(Date.now());
    setRetryPending(false);
    // A single UI timer enables manual retry; it does not poll the backend.
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, health.retryAt - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [health]);
  if (!health) return null;
  return <aside role="status" aria-label="Live service availability" className="border-b border-[#d7cbb8] bg-[#f1e8d8] px-5 py-3 text-sm leading-6 text-[#40392e]">
    <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><strong>Live updates are temporarily unavailable.</strong><p>{admin ? "Reports and saved records may be out of date. An empty result does not confirm there are no orders." : "Saved pieces may still be available to browse. We cannot confirm current stock or order status right now."} If you already paid, check your order status before paying again.</p></div>
      <button type="button" disabled={retryPending || now < health.retryAt} className="min-h-11 shrink-0 rounded-lg border border-current px-4 font-semibold disabled:cursor-wait disabled:opacity-60" onClick={() => {
        if (Date.now() < health.retryAt) return;
        setRetryPending(true);
        // Retry existing reads only; never resubmit a checkout or payment.
        window.dispatchEvent(new Event("cozycraft:refresh-catalog"));
        window.dispatchEvent(new Event("online"));
      }}>{retryPending ? "Checking live updates…" : now < health.retryAt ? "Please wait before retrying" : "Try live updates again"}</button>
    </div>
  </aside>;
}
