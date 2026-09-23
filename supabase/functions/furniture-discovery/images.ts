// Convert legacy AVIF files mislabeled as JPEG only for the vision request.
// Original catalog images are never changed. Codecs are pinned and WASM verified.
import decode, { init as initAvif } from "npm:@jsquash/avif@2.1.1/decode.js";
import encode, { init as initJpeg } from "npm:@jsquash/jpeg@1.6.0/encode.js";
let codecs: Promise<void> | undefined;
async function wasm(path: string, hash: string) {
  const response = await fetch(`https://unpkg.com/${path}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("codec_unavailable");
  const bytes = await response.arrayBuffer();
  const actual = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (actual !== hash) throw new Error("codec_integrity");
  return WebAssembly.compile(bytes);
}
async function ready() {
  if (!codecs)
    codecs = Promise.all([
      wasm(
        "@jsquash/avif@2.1.1/codec/dec/avif_dec.wasm",
        "5c35dde23dfd862088a49a6b8a9fe81f9f9a1a46aaa27de7efd7baa7611c4b47",
      ).then((m) => initAvif(m)),
      wasm(
        "@jsquash/jpeg@1.6.0/codec/enc/mozjpeg_enc.wasm",
        "24d4177f1c4963e2058b107189249651c61fdef125570e79b1dfb63c8bb49326",
      ).then((m) => initJpeg(m)),
    ])
      .then(() => undefined)
      .catch((error) => {
        codecs = undefined;
        throw error;
      });
  return codecs;
}
export function imageFormat(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71)
    return "png";
  const head = String.fromCharCode(...bytes.subarray(0, 40));
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "webp";
  if (head.slice(4, 8) === "ftyp" && /avif|avis/.test(head)) return "avif";
  throw new Error("image_format_unsupported");
}
export async function visionImage(url: string, projectUrl: string) {
  const parsed = new URL(url);
  if (
    parsed.origin !== new URL(projectUrl).origin ||
    !parsed.pathname.startsWith("/storage/v1/object/public/product-images/") ||
    parsed.username ||
    parsed.password
  )
    throw new Error("image_source_invalid");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || Number(response.headers.get("content-length")) > 5000000)
    throw new Error("image_unavailable");
  // Bound the stream, not just a potentially absent Content-Length header.
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 5000000) {
      await reader.cancel();
      throw new Error("image_too_large");
    }
    chunks.push(value);
  }
  let bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let format = imageFormat(bytes);
  if (format === "avif") {
    // Check AVIF spatial extents before allocating a decoded bitmap.
    const view = new DataView(bytes.buffer);
    let bounded = false;
    for (let i = 4; i < bytes.length - 16; i++)
      if (
        bytes[i] === 105 &&
        bytes[i + 1] === 115 &&
        bytes[i + 2] === 112 &&
        bytes[i + 3] === 101
      ) {
        const width = view.getUint32(i + 8),
          height = view.getUint32(i + 12);
        if (!width || !height || width * height > 8000000)
          throw new Error("image_too_large");
        bounded = true;
      }
    if (!bounded) throw new Error("image_dimensions_unknown");
    await ready();
    const pixels = await decode(bytes.buffer);
    if (!pixels || pixels.width * pixels.height > 8000000)
      throw new Error("image_decode_failed");
    bytes = new Uint8Array(await encode(pixels, { quality: 85 }));
    format = "jpeg";
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:image/${format};base64,${btoa(binary)}`;
}
