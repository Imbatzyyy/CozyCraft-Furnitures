import { sessionStore } from "@/lib/shared/browser-storage";
import { cleanAssistantReply, containsSensitiveChatData, safeAssistantActions, type AssistantAction } from "../../../../supabase/functions/_shared/cozycraft-assistant-knowledge";
export { cleanAssistantReply, containsSensitiveChatData, safeAssistantActions };
export type CareMessage = { from: "care" | "you"; text: string; actions?: AssistantAction[]; includeInContext?: boolean; sources?: string[] };
export const greeting = (): CareMessage[] => [{ from: "care", text: "Hello, I’m Cozy. Tell me what you’re trying to do, and I’ll help you find the right product, answer, or next step on CozyCraft.", includeInContext: false }];
export const conversationKey = (owner: string) => `cozycraft-care-chat:v2:${owner}`;
export function readConversation(key: string): CareMessage[] {
  try {
    const saved = JSON.parse(sessionStore.getItem(key) ?? "null");
    if (!saved || !Number.isFinite(saved.at) || Date.now() - saved.at > 6 * 60 * 60 * 1000 || saved.at > Date.now() || !Array.isArray(saved.messages)) return greeting();
    const rows = saved.messages.slice(-24).flatMap((item: Partial<CareMessage>) => {
      if (!item || !["you", "care"].includes(item.from ?? "") || typeof item.text !== "string" || !item.text.trim() || containsSensitiveChatData(item.text)) return [];
      return [{ from: item.from, text: item.from === "care" ? cleanAssistantReply(item.text) : item.text.slice(0, 2000), includeInContext: item.includeInContext !== false, actions: safeAssistantActions(item.actions) } as CareMessage];
    });
    return rows.length ? rows : greeting();
  } catch { return greeting(); }
}
export function persistConversation(key: string, messages: CareMessage[]) {
  sessionStore.setItem(key, JSON.stringify({ at: Date.now(), messages: messages.filter(item => !containsSensitiveChatData(item.text)).slice(-24) }));
}
export function replyBlocks(text: string): Array<{ kind: "paragraph" | "steps"; lines: string[] }> {
  const blocks: Array<{ kind: "paragraph" | "steps"; lines: string[] }> = [];
  for (const paragraph of cleanAssistantReply(text).split(/\n\s*\n/)) {
    for (const line of paragraph.split("\n").filter(Boolean)) {
      const step = line.match(/^\s*\d+[.)]\s+(.+)/);
      const kind = step ? "steps" : "paragraph";
      const last = blocks.at(-1);
      if (last?.kind === kind) last.lines.push(step ? step[1] : line);
      else blocks.push({ kind, lines: [step ? step[1] : line] });
    }
    // Preserve paragraph boundaries without rendering raw markdown.
    blocks.push({ kind: "paragraph", lines: [] });
  }
  return blocks.filter(block => block.lines.length);
}
