import { supabase } from "@/services/supabase/client";
import { functionErrorMessage } from "@/lib/shared/function-error";
import {
  validateIntent,
  type SearchIntent,
  type VisualProfile,
} from "../../../../supabase/functions/_shared/furniture-discovery";

let snapshot: { until: number; rows: VisualProfile[] } | null = null;
let pending: Promise<VisualProfile[]> | null = null;
const intents = new Map<string, SearchIntent>();
export function loadVisualProfiles(force = false): Promise<VisualProfile[]> {
  if (!force && snapshot && snapshot.until > Date.now())
    return Promise.resolve(snapshot.rows);
  if (pending) return pending;
  pending = (async () => {
    const rows: VisualProfile[] = [];
    for (let from = 0; from < 5000; from += 500) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const { data, error } = await supabase
        .from("product_visual_profiles")
        .select(
          "product_id,image_key,version,colors,appearance,features,caption,clarity,analysed_at",
        )
        .order("product_id")
        .range(from, from + 499)
        .abortSignal(controller.signal)
        .then(
          (result) => {
            clearTimeout(timer);
            return result;
          },
          (error) => {
            clearTimeout(timer);
            throw error;
          },
        );
      if (error)
        throw new Error(
          "Photo matching could not be loaded. You can still search with verified product specifications.",
        );
      rows.push(...(data as VisualProfile[]));
      if (data.length < 500) break;
      if (from === 4500)
        throw new Error(
          "The visual catalog is larger than supported. Please contact support.",
        );
    }
    snapshot = { until: Date.now() + 300000, rows };
    return rows;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
export async function interpretFurniture(text: string, signal: AbortSignal) {
  const key = text.trim().toLowerCase();
  const known = intents.get(key);
  if (known) return known;
  const result = await supabase.functions.invoke("furniture-discovery", {
    body: { action: "interpret", text: text.trim() },
    signal,
  });
  if (result.error)
    throw new Error(
      await functionErrorMessage(
        result.error,
        "Intelligent search is unavailable. Clear the description and use the filters, or retry.",
      ),
    );
  if (!result.data?.intent)
    throw new Error("Your description could not be interpreted. Please retry.");
  const intent = validateIntent(result.data.intent);
  if (intents.size >= 40) intents.clear();
  intents.set(key, intent);
  return intent;
}
