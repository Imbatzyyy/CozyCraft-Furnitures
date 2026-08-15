import { supabase } from "@/services/supabase/client";

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

const pageCache = new Map<string, ContentPage>();
let bannerCache: HomepageBanner[] | null = null;

export async function getContentPage(slug: string, fresh = false) {
  if (!fresh && pageCache.has(slug)) return pageCache.get(slug) ?? null;
  const { data, error } = await supabase
    .from("content_pages")
    .select("slug,eyebrow,title,summary,body,published,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (data) pageCache.set(slug, data as ContentPage);
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
  if (slug) pageCache.delete(slug);
  else pageCache.clear();
  bannerCache = null;
}
