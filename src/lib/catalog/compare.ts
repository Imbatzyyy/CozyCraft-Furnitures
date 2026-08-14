const COMPARE_STORAGE_KEY = "cozycraft-product-compare";
export const COMPARE_CHANGE_EVENT = "cozycraft:compare-change";
export const MAX_COMPARE_PRODUCTS = 4;
type CompareStorage = Pick<Storage, "getItem" | "setItem">;

export function readComparedProductIds(storage?: CompareStorage): string[] {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return [];
  try {
    const parsed = JSON.parse(target.getItem(COMPARE_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0))]
      .slice(0, MAX_COMPARE_PRODUCTS);
  } catch {
    return [];
  }
}

export function writeComparedProductIds(ids: string[], storage?: CompareStorage): string[] {
  const next = [...new Set(ids)].slice(0, MAX_COMPARE_PRODUCTS);
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return next;
  target.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
  if (typeof window !== "undefined" && target === window.localStorage) {
    window.dispatchEvent(new CustomEvent(COMPARE_CHANGE_EVENT, { detail: next }));
  }
  return next;
}

export function toggleComparedProduct(id: string, storage?: CompareStorage): {
  ids: string[];
  added: boolean;
  limitReached: boolean;
} {
  const current = readComparedProductIds(storage);
  if (current.includes(id)) {
    return { ids: writeComparedProductIds(current.filter((value) => value !== id), storage), added: false, limitReached: false };
  }
  if (current.length >= MAX_COMPARE_PRODUCTS) {
    return { ids: current, added: false, limitReached: true };
  }
  return { ids: writeComparedProductIds([...current, id], storage), added: true, limitReached: false };
}
