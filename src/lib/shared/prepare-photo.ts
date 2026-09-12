import { optimizeImageUpload } from "./image-upload";

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
export const isHeicPhoto = (file: Pick<File, "name" | "type">) => /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
export async function prepareCustomerPhoto(file: File): Promise<File> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose a photo no larger than 5 MB.");
  if (!isHeicPhoto(file) && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, WebP, HEIC, or HEIF photo.");
  let prepared = file;
  if (isHeicPhoto(file)) {
    try {
      // Lazy local conversion. Never upload original photos to a conversion service.
      const { heicTo } = await import("heic-to/csp");
      const jpeg = await heicTo({ blob: new Blob([await file.arrayBuffer()], { type: file.type || "image/heic" }), type: "image/jpeg", quality: 0.84 });
      prepared = new File([jpeg], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch { throw new Error("This iPhone photo couldn't be converted. Please choose another photo or export it as JPG."); }
  }
  const optimized = await optimizeImageUpload(prepared, { maxDimension: 1600, quality: 0.84 });
  if (optimized.size > 5 * 1024 * 1024) throw new Error("The converted photo is too large. Choose a smaller photo.");
  return optimized;
}
