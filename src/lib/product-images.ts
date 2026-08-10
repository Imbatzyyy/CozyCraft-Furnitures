export type ProductImageSource = {
  images: string[];
  mainImageIndex?: number | null;
};

export function productMainImageIndex(product: ProductImageSource): number {
  if (!product.images.length) return 0;

  const requested = Number.isInteger(product.mainImageIndex)
    ? Number(product.mainImageIndex)
    : 0;

  return Math.min(Math.max(requested, 0), product.images.length - 1);
}

export function primaryProductImage(product: ProductImageSource): string {
  return product.images[productMainImageIndex(product)] ?? product.images[0] ?? "";
}

/**
 * Stores the chosen main photo first as a backwards-compatible API contract.
 * Current clients can use main_image_index, while older/mobile clients that
 * read images[0] still receive the correct storefront image.
 */
export function canonicalProductImages(images: string[], mainImageIndex: number) {
  if (!images.length) return { images: [] as string[], mainImageIndex: 0 };

  const safeIndex = Math.min(Math.max(mainImageIndex, 0), images.length - 1);
  if (safeIndex === 0) return { images: [...images], mainImageIndex: 0 };

  return {
    images: [images[safeIndex], ...images.filter((_, index) => index !== safeIndex)],
    mainImageIndex: 0,
  };
}
