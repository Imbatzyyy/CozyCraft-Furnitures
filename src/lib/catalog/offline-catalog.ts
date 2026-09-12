import type { Product } from "@/app/core";
import { localStore } from "@/lib/shared/browser-storage";

const KEY = "cozycraft-public-catalog-v1";
export const CATALOG_STALE_EVENT = "cozycraft:catalog-stale";
let catalogStale = false;
export const isCatalogStale = () => catalogStale;
export function setCatalogStale(value: boolean) {
  catalogStale = value;
  window.dispatchEvent(new CustomEvent(CATALOG_STALE_EVENT, { detail: value }));
}
export function readOfflineCatalog(): Product[] {
  try {
    const value = JSON.parse(localStore.getItem(KEY) ?? "null");
    if (!value || !Number.isFinite(value.savedAt) || value.savedAt > Date.now() || Date.now() - value.savedAt > 7 * 24 * 60 * 60 * 1000 || !Array.isArray(value.products)) return [];
    return value.products.filter((p: Product) => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.images) && p.status === "active");
  } catch { return []; }
}
export function saveOfflineCatalog(products: Product[]) {
  // Only the public, active catalog. Never cache orders, profiles, or admin data.
  localStore.setItem(KEY, JSON.stringify({ savedAt: Date.now(), products: products.filter(p => p.status === "active") }));
}
