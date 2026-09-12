import { supabase } from "@/services/supabase/client";
import { functionErrorMessage } from "@/lib/shared/function-error";
import { safeAssistantPath } from "../../../../supabase/functions/_shared/cozycraft-assistant-knowledge";
import { cleanAssistantReply, safeAssistantActions, type CareMessage } from "./conversation";
export type AssistantRequest = { message: string; history: Array<{ role: "user" | "assistant"; content: string }>; currentPath: string };
export async function askCare(body: AssistantRequest, ownerId: string | null, signal: AbortSignal): Promise<{ message: CareMessage; retryAfter: number }> {
  const { data } = await supabase.auth.getSession();
  if (signal.aborted) throw new Error("The request was stopped. Please try again.");
  // Prevent a request from one conversation being sent under a newly signed-in account.
  if ((data.session?.user.id ?? null) !== ownerId) throw new Error("Your sign-in changed. Reopen chat to continue with the current account.");
  const token = data.session?.access_token;
  const result = await supabase.functions.invoke("cozycraft-assistant", { body: { ...body, currentPath: safeAssistantPath(body.currentPath) ?? "" }, signal, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (result.error) throw new Error(await functionErrorMessage(result.error, "I couldn’t connect to customer care. Please try again, or open Help and Support."));
  const reply = typeof result.data?.reply === "string" ? cleanAssistantReply(result.data.reply) : "";
  if (!reply) throw new Error("The assistant did not return a complete answer. Please try again.");
  return { message: { from: "care", text: reply, actions: safeAssistantActions(result.data.actions), includeInContext: !result.data.fallback && !result.data.scopeRestricted, sources: Array.isArray(result.data.sources) ? result.data.sources.filter((s: unknown) => typeof s === "string" && ["Website help", "Your account records", "Current store settings", "Current product catalog"].includes(s)).slice(0, 3) : [] }, retryAfter: result.data.rateLimited ? Math.min(120, Math.max(1, Number(result.data.retryAfterSeconds) || 60)) : 0 };
}
