import { localStore } from "@/lib/shared/browser-storage";
import { editorialImageSources, portraitImageSources } from "@/lib/catalog/responsive-image";

/** First hero photograph shown before (and unless) managed banners replace it. */
export const HERO_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1724582586529-62622e50c0b3?auto=format&fit=crop&w=1800&q=88";

const BANNER_CACHE_KEY = "cozycraft-home-banners-v1";
const PHONE_PORTRAIT = "(max-width: 767px) and (orientation: portrait)";

export type CachedBanner = {
  id: string; eyebrow: string; title: string; subtitle: string; image_url: string;
  cta_label: string; cta_path: string; active: boolean; starts_at: string | null;
  ends_at: string | null; sort_order: number; updated_at: string;
};

export const isPhonePortrait = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.(PHONE_PORTRAIT).matches);

/** What the hero <img> requests for one slide, for this screen shape. */
export function heroImageSources(image: string, phonePortrait: boolean) {
  const sources = (phonePortrait ? portraitImageSources(image) : null) ?? editorialImageSources(image);
  return { src: sources?.src ?? image, srcSet: sources?.srcSet, sizes: "100vw" };
}

/** Public banners only. Lets a returning visitor see the right hero at once. */
export function saveHomepageBannerCache(banners: CachedBanner[]) {
  localStore.setItem(BANNER_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), banners }));
}

export function readHomepageBannerCache(): CachedBanner[] {
  try {
    const value = JSON.parse(localStore.getItem(BANNER_CACHE_KEY) ?? "null");
    const now = Date.now();
    if (!value || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt > 7 * 24 * 60 * 60 * 1000 || !Array.isArray(value.banners)) return [];
    return (value.banners as CachedBanner[]).filter((banner) =>
      banner && typeof banner.id === "string" && typeof banner.title === "string" &&
      typeof banner.image_url === "string" && /^https:\/\//.test(banner.image_url) && banner.active !== false &&
      (!banner.starts_at || Date.parse(banner.starts_at) <= now) && (!banner.ends_at || Date.parse(banner.ends_at) > now));
  } catch { return []; }
}

/**
 * Start downloading the first hero photograph while the application code and
 * the welcome screen are still running, so it is already there when the home
 * page appears. Uses the same candidate list as the hero itself, so the
 * browser fetches exactly one file.
 */
export function preloadHomeHero() {
  if (typeof document === "undefined" || !["/", "/home"].includes(window.location.pathname)) return;
  const image = readHomepageBannerCache()[0]?.image_url ?? HERO_FALLBACK_IMAGE;
  const sources = heroImageSources(image, isPhonePortrait());
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = sources.src;
  if (sources.srcSet) { link.setAttribute("imagesrcset", sources.srcSet); link.setAttribute("imagesizes", sources.sizes); }
  link.setAttribute("fetchpriority", "high");
  document.head.appendChild(link);
}
