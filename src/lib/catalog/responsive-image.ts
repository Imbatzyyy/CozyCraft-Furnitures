const publicProducts = /^https:\/\/gwjsivqksyimuabbdyqq\.supabase\.co\/storage\/v1\/object\/public\/product-images\//;
/** Only intentionally public product media may enter the public CDN. */
export function productImageSources(source: string | undefined, enabled: boolean) {
  if (!enabled || !source || !publicProducts.test(source)) return null;
  try {
    const url = new URL(source);
    if (!publicProducts.test(url.href)) return null;
    if (url.username || url.password || url.search || url.hash || /(?:^|\/)\.\.(?:\/|$)/.test(decodeURIComponent(url.pathname))) return null;
    const variant = (width: number) => `/.netlify/images?${new URLSearchParams({ url: source, w: String(width), fit: 'contain', q: '80' })}`;
    return { src: variant(960), srcSet: [320,640,960,1440].map(width => `${variant(width)} ${width}w`).join(', ') };
  } catch { return null; }
}

const editorialWidths = [480, 768, 1080, 1440, 1800];
/**
 * Editorial photography is served by Unsplash's image service, which resizes
 * on request. Offer the browser smaller renditions of the same picture so a
 * phone never downloads a desktop-sized file. Never upscales past the width
 * the page originally asked for.
 */
export function editorialImageSources(source: string | undefined) {
  if (!source || !source.startsWith("https://images.unsplash.com/")) return null;
  try {
    const url = new URL(source);
    const original = Number(url.searchParams.get("w"));
    if (!Number.isFinite(original) || original < 400 || url.searchParams.has("h")) return null;
    const widths = [...editorialWidths.filter(width => width < original), original];
    const variant = (width: number) => { const next = new URL(url); next.searchParams.set("w", String(width)); return next.href; };
    return { src: source, srcSet: widths.map(width => `${variant(width)} ${width}w`).join(", ") };
  } catch { return null; }
}

/**
 * A tall, phone-shaped crop of a full-screen editorial photograph. A landscape
 * photo stretched to cover a portrait screen throws most of its pixels away;
 * asking for the visible strip alone is both sharper and far lighter.
 */
export function portraitImageSources(source: string | undefined) {
  if (!source || !source.startsWith("https://images.unsplash.com/")) return null;
  try {
    const url = new URL(source);
    if (!url.searchParams.has("w")) return null;
    const variant = (width: number) => {
      const next = new URL(url);
      next.searchParams.set("w", String(width));
      next.searchParams.set("h", String(Math.round(width * 2.1)));
      next.searchParams.set("fit", "crop");
      next.searchParams.set("q", "72");
      return next.href;
    };
    return { src: variant(828), srcSet: [480, 640, 828].map(width => `${variant(width)} ${width}w`).join(", ") };
  } catch { return null; }
}
