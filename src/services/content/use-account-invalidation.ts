import { useEffect, useRef } from "react";
import { supabase } from "@/services/supabase/client";
import { createRefreshScheduler } from "@/lib/admin/refresh-scheduler";
import { watchVisibleRecovery } from "@/lib/shared/visible-recovery";

/** Subscribe only for a mounted account panel, only to the signed-in owner.
 * Hidden-tab events are accumulated and reconciled once on return. No polling.
 */
export function useAccountInvalidation(userId: string, enabled: boolean, tables: readonly string[], invalidate: () => void) {
  const callback = useRef(invalidate);
  callback.current = invalidate;
  const key = tables.join(",");
  useEffect(() => {
    if (!userId || !enabled) return;
    const scheduler = createRefreshScheduler(async () => callback.current(), 300, 1500);
    const recovery = watchVisibleRecovery(scheduler.request, 30_000);
    let channel = supabase.channel(`account-panel:${userId}:${key}`);
    for (const table of key.split(",")) channel = channel.on("postgres_changes", {
      event: "*", schema: "public", table, filter: `user_id=eq.${userId}`,
    }, recovery.invalidate);
    channel.subscribe(status => { if (status === "SUBSCRIBED") recovery.invalidate(); });
    return () => { recovery.dispose(); scheduler.dispose(); void supabase.removeChannel(channel); };
  }, [userId, enabled, key]);
}
