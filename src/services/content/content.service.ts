import { supabase } from "@/services/supabase/client";
import { localStore, storageKeys } from "@/lib/shared/browser-storage";

export type ContentPage = {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  body: string;
  published: boolean;
  updated_at: string;
};

export type HomepageBanner = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  image_url: string;
  cta_label: string;
  cta_path: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  updated_at: string;
};

const pageCache = new Map<string, { page: ContentPage; fetchedAt: number }>();
const pageRequests = new Map<string, Promise<ContentPage | null>>();
const pageVersions = new Map<string, number>();
const cacheKey = (slug: string) => `cozycraft-public-content-v1:${slug}`;
export function getCachedContentPage(slug: string): ContentPage | null {
  try {
    const record = pageCache.get(slug) ?? JSON.parse(localStore.getItem(cacheKey(slug)) ?? "null");
    if (record?.page?.slug === slug && record.page.published === true && typeof record.page.body === "string"
      && Number.isFinite(record.fetchedAt) && record.fetchedAt <= Date.now()
      && Date.now() - record.fetchedAt < 7 * 24 * 60 * 60 * 1000) return record.page;
  } catch { /* Ignore expired or corrupt offline content. */ }
  return null;
}
let bannerCache: HomepageBanner[] | null = null;

export async function getContentPage(slug: string, fresh = false) {
  const cached = pageCache.get(slug);
  if (!fresh && cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) return cached.page;
  const pending = pageRequests.get(slug);
  if (pending) return pending;
  const request = fetchContentPage(slug);
  pageRequests.set(slug, request);
  try { return await request; }
  finally { if (pageRequests.get(slug) === request) pageRequests.delete(slug); }
}

async function fetchContentPage(slug: string) {
  const version = pageVersions.get(slug) ?? 0;
  const { data, error } = await supabase
    .from("content_pages")
    .select("slug,eyebrow,title,summary,body,published,updated_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  if ((pageVersions.get(slug) ?? 0) !== version) return (data as ContentPage | null) ?? null;
  if (data) {
    const record = { page: data as ContentPage, fetchedAt: Date.now() };
    pageCache.set(slug, record);
    localStore.setItem(cacheKey(slug), JSON.stringify(record));
  } else { pageCache.delete(slug); localStore.removeItem(cacheKey(slug)); }
  return (data as ContentPage | null) ?? null;
}

export async function getHomepageBanners(fresh = false) {
  if (!fresh && bannerCache) return bannerCache;
  const { data, error } = await supabase
    .from("homepage_banners")
    .select("id,eyebrow,title,subtitle,image_url,cta_label,cta_path,active,starts_at,ends_at,sort_order,updated_at")
    .order("sort_order");
  if (error) throw error;
  bannerCache = (data ?? []) as HomepageBanner[];
  return bannerCache;
}

export function clearContentCache(slug?: string) {
  const slugs = slug ? [slug] : [...new Set([...pageCache.keys(), ...pageRequests.keys(), ...storageKeys(localStore).filter(key => key.startsWith("cozycraft-public-content-v1:")).map(key => key.slice("cozycraft-public-content-v1:".length))])];
  for (const key of slugs) {
    pageVersions.set(key, (pageVersions.get(key) ?? 0) + 1);
    pageCache.delete(key);
    pageRequests.delete(key);
    localStore.removeItem(cacheKey(key));
  }
  bannerCache = null;
}
