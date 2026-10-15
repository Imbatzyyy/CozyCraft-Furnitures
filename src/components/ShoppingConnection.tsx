import { useSyncExternalStore } from "react";
import { isOffline } from "@/lib/shared/network";
import { CATALOG_STALE_EVENT, isCatalogStale } from "@/lib/catalog/offline-catalog";

export type ShoppingConnectionStatus = "connected" | "offline" | "saved";

const connectionSnapshot = (): ShoppingConnectionStatus =>
  isOffline() ? "offline" : isCatalogStale() ? "saved" : "connected";
const serverSnapshot = (): ShoppingConnectionStatus => "connected";
function subscribeConnection(onChange: () => void) {
  // Recheck the canonical state on page restoration as well as network changes.
  // No polling or requests: the catalog loader still owns freshness/retries.
  const events = ["online", "offline", "pageshow", CATALOG_STALE_EVENT];
  events.forEach(event => window.addEventListener(event, onChange));
  return () => events.forEach(event => window.removeEventListener(event, onChange));
}

export function useShoppingConnection() {
  return useSyncExternalStore(subscribeConnection, connectionSnapshot, serverSnapshot);
}

export function ShoppingConnection({ status }: { status: ShoppingConnectionStatus }) {
  if (status === "connected") return null;
  const offline = status === "offline";
  return <aside role="status" aria-label="Shopping connection" className="border-b border-[#d7cbb8] bg-[#f1e8d8] px-5 py-3 text-center text-sm leading-6 text-[#40392e]"><strong>{offline ? "You're offline." : "Showing a saved catalog."}</strong> Previously loaded pieces may remain available to browse. Reconnect to confirm prices and stock before checkout. {!offline && <button type="button" className="ml-3 min-h-11 font-semibold underline" onClick={() => window.dispatchEvent(new Event("cozycraft:refresh-catalog"))}>Try again</button>}</aside>;
}
