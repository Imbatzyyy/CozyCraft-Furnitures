import { describe, expect, it } from 'vitest';
import { productImageSources } from './responsive-image';
const base = 'https://gwjsivqksyimuabbdyqq.supabase.co/storage/v1/object/';
describe('public product image delivery', () => {
  it('provides four bounded responsive sizes without cropping', () => {
    const result = productImageSources(base+'public/product-images/sofa.webp',true)!;
    expect(result.src).toContain('fit=contain');
    expect(result.srcSet.split(', ')).toHaveLength(4);
    expect(result.srcSet).toContain('320w'); expect(result.srcSet).toContain('1440w');
  });
  it.each(['sign/avatars/me.jpg?token=private','public/review-images/photo.webp','public/product-images/photo.webp?token=private','public/product-images/%2e%2e/avatars/me.jpg'])(
    'never forwards private or ambiguous URL %s to the image CDN',path => expect(productImageSources(base+path,true)).toBeNull(),
  );
  it('keeps local development and unknown providers on original sources', () => {
    expect(productImageSources(base+'public/product-images/sofa.webp',false)).toBeNull();
    expect(productImageSources('https://example.com/image.webp',true)).toBeNull();
  });
});
