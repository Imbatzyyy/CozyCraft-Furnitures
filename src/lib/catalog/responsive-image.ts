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
