import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase/client";
import { effectiveCodLimit } from "./payment-policy";

export function useCheckoutPaymentPolicy(userId: string | null | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ owner: "", loading: true, error: "", codLimit: 20_000, outstandingCod: 0 });
  useEffect(() => {
    let active = true;
    if (!userId) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    setState({ owner: userId, loading: true, error: "", codLimit: 20_000, outstandingCod: 0 });
    // One compact, account-scoped snapshot per checkout/retry; no polling or order downloads.
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("get_checkout_payment_policy").abortSignal(controller.signal);
        if (error) throw error;
        const result = data as { cod_limit?: number; outstanding_cod_total?: number } | null;
        if (!result || typeof result.cod_limit !== "number" || !Number.isFinite(result.cod_limit) || result.cod_limit <= 0
          || typeof result.outstanding_cod_total !== "number" || !Number.isFinite(result.outstanding_cod_total) || result.outstanding_cod_total < 0) throw new Error("Invalid policy");
        if (active) setState({ owner: userId, loading: false, error: "", codLimit: effectiveCodLimit(result.cod_limit), outstandingCod: Math.max(0, Number(result.outstanding_cod_total)) });
      } catch {
        if (active) setState({ owner: userId, loading: false, error: "We couldn’t check your COD availability. Retry or choose an online payment.", codLimit: 20_000, outstandingCod: 0 });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [userId, attempt]);
  const current = state.owner === userId ? state : { ...state, loading: true, error: "", outstandingCod: 0 };
  return { ...current, retry: () => setAttempt(value => value + 1) };
}
