import { useEffect, useRef } from "react";
import { adminSupabase } from "@/services/supabase/client";
import { watchVisibleRecovery } from "@/lib/shared/visible-recovery";
import { createRefreshScheduler } from "@/lib/admin/refresh-scheduler";

/** Consumer owns the bounded scheduler; this hook owns its visible channel. */
export function useAdminTableInvalidation(tables: readonly string[], reload: () => void | Promise<void>, enabled = true) {
  const callback = useRef(reload); callback.current = reload;
  const key = tables.join(",");
  useEffect(() => {
    if (!enabled) return;
    const scheduler = createRefreshScheduler(async () => { await callback.current(); }, 200, 1500);
    const recovery = watchVisibleRecovery(scheduler.request);
    let channel = adminSupabase.channel(`admin-read-model:${key}`);
    for (const table of key.split(",")) channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, recovery.invalidate);
    channel.subscribe(status => { if (status === "SUBSCRIBED") recovery.invalidate(); });
    return () => { recovery.dispose(); scheduler.dispose(); void adminSupabase.removeChannel(channel); };
  }, [key, enabled]);
}
