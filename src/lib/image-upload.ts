type ImageUploadOptions = {
  maxDimension?: number;
  quality?: number;
};

const optimizedName = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/\s+/g, "-") + ".webp";

/**
 * Shrinks oversized browser image uploads before they reach Storage. The
 * original file is returned whenever the browser cannot optimize it or the
 * optimized result would be larger, so uploads remain resilient.
 */
export async function optimizeImageUpload(
  file: File,
  { maxDimension = 1920, quality = 0.86 }: ImageUploadOptions = {},
): Promise<File> {
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml" ||
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], optimizedName(file.name), {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
