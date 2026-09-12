import { useEffect, useState } from "react";
import { isOffline } from "@/lib/shared/network";
import { CATALOG_STALE_EVENT, isCatalogStale } from "@/lib/catalog/offline-catalog";

export function ShoppingConnection() {
  const [offline, setOffline] = useState(isOffline);
  const [stale, setStale] = useState(isCatalogStale);
  useEffect(() => {
    const connection = () => setOffline(isOffline());
    const catalog = (event: Event) => setStale(Boolean((event as CustomEvent).detail));
    window.addEventListener("online", connection); window.addEventListener("offline", connection);
    window.addEventListener(CATALOG_STALE_EVENT, catalog);
    return () => { window.removeEventListener("online", connection); window.removeEventListener("offline", connection); window.removeEventListener(CATALOG_STALE_EVENT, catalog); };
  }, []);
  if (!offline && !stale) return null;
  return <aside role="status" className="border-b border-[#d7cbb8] bg-[#f1e8d8] px-5 py-3 text-center text-sm leading-6 text-[#40392e]"><strong>{offline ? "You're offline." : "Showing a saved catalog."}</strong> Previously loaded pieces may remain available to browse. Reconnect to confirm prices and stock before checkout. {!offline && <button type="button" className="ml-3 min-h-11 font-semibold underline" onClick={() => window.dispatchEvent(new Event("cozycraft:refresh-catalog"))}>Try again</button>}</aside>;
}
