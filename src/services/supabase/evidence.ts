import { supabase } from "./client";

export async function submitEvidence(fields: Record<string, string>, files: File[]): Promise<string | null> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const file of files) form.append("file", file);
  try {
    const { data, error } = await supabase.functions.invoke("submit-customer-evidence", { body: form });
    if (!error && data?.success === true) return null;
    const context = error?.context;
    const info = context instanceof Response ? await context.clone().json().catch(() => null) : null;
    if (typeof info?.error === "string") return info.error;
  } catch { /* The server may have committed before the connection was lost. */ }
  return "We couldn't confirm your submission. Check your requests before submitting again.";
}
