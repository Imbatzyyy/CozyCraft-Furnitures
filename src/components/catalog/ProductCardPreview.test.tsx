// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.cozycraftfurnitures.com"}
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCardPreview } from "./ProductCardPreview";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const photos = ["/cover.webp", "/alternate.webp", "/third.webp"];
async function render(hovered = false, images = photos, mainIndex = 0) {
  await act(async () => root.render(<ProductCardPreview name="Sofa" images={images} mainIndex={mainIndex} hovered={hovered} />));
}
async function advance(ms = 500) { await act(async () => vi.advanceTimersByTime(ms)); }
const images = () => [...host.querySelectorAll("img")];
function loaded(image: HTMLImageElement, decode?: () => Promise<void>) {
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 640 },
    decode: { configurable: true, value: decode },
  });
  image.dispatchEvent(new Event("load"));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe("product-card hover photo continuity", () => {
  it("keeps the original mounted and visible while the alternate loads and decodes", async () => {
    await render(); const cover = images()[0];
    await render(true); await advance(499); expect(images()).toHaveLength(1);
    await advance(1); const alternate = images()[1];
    expect(images()[0]).toBe(cover);
    expect(alternate.className).toContain("opacity-0");
    let finishDecode!: () => void;
    await act(async () => loaded(alternate, () => new Promise<void>((resolve) => { finishDecode = resolve; })));
    expect(alternate.className).toContain("opacity-0");
    expect(cover.getAttribute("aria-hidden")).toBeNull();
    await act(async () => finishDecode());
    expect(alternate.className).toContain("opacity-100");
    expect(cover.getAttribute("aria-hidden")).toBe("true");
    expect(host.querySelectorAll("span")[1].className).toContain("w-4");
  });

  it("restores the same cover on mouse leave and reuses the loaded alternate on re-entry", async () => {
    await render(true); await advance(); const [cover, alternate] = images();
    await act(async () => loaded(alternate));
    await render(false);
    expect(images()[0]).toBe(cover); expect(alternate.className).toContain("opacity-0");
    await render(true); await advance();
    expect(images()[1]).toBe(alternate); expect(alternate.className).toContain("opacity-100");
    await advance(60_000); expect(images()).toHaveLength(2);
  });

  it("does not download an alternate for brief pointer passes", async () => {
    await render(true); await advance(200); await render(false); await advance();
    expect(images()).toHaveLength(1);
  });

  it("does not show a late-loading alternate after the pointer leaves", async () => {
    await render(true); await advance(); const alternate = images()[1];
    await render(false); await act(async () => loaded(alternate));
    expect(alternate.className).toContain("opacity-0");
    expect(images()[0].getAttribute("aria-hidden")).toBeNull();
  });

  it("retains the cover if the alternate fails, including when the error placeholder loads", async () => {
    await render(true); await advance(); const cover = images()[0];
    await act(async () => images()[1].dispatchEvent(new Event("error")));
    await act(async () => loaded(images()[1]));
    expect(images()[0]).toBe(cover); expect(cover.getAttribute("aria-hidden")).toBeNull();
    expect(host.querySelector(".opacity-100")).toBeNull();
    expect(host.querySelectorAll("span")[0].className).toContain("w-4");
  });

  it("keeps the cover while the CDN falls back to the original and then reveals the loaded photo", async () => {
    vi.stubEnv("PROD", true);
    const urls = ["cover", "alternate"].map((name) => `https://gwjsivqksyimuabbdyqq.supabase.co/storage/v1/object/public/product-images/${name}.webp`);
    await render(true, urls); await advance(); const alternate = images()[1];
    expect(alternate.getAttribute("src")).toContain("/.netlify/images?");
    await act(async () => alternate.dispatchEvent(new Event("error")));
    expect(alternate.getAttribute("src")).toBe(urls[1]);
    expect(alternate.className).toContain("opacity-0");
    await act(async () => loaded(alternate));
    expect(alternate.className).toContain("opacity-100");
  });

  it("discards old readiness and pending decode when the catalog images change", async () => {
    await render(true); await advance(); let finishDecode!: () => void;
    await act(async () => loaded(images()[1], () => new Promise<void>((resolve) => { finishDecode = resolve; })));
    await render(true, ["/new-cover.webp", "/new-alternate.webp"]); await advance();
    await act(async () => finishDecode());
    expect(images()[0].getAttribute("src")).toBe("/new-cover.webp");
    expect(images()[1].className).toContain("opacity-0");
  });

  it("honors the configured cover index and skips empty or duplicate alternates", async () => {
    await render(true, ["/alternate.webp", "/cover.webp", "", "/cover.webp"], 1); await advance();
    expect(images()[0].getAttribute("src")).toBe("/cover.webp");
    expect(images()[1].getAttribute("src")).toBe("/alternate.webp");
  });

  it.each([{ photos: [] }, { photos: ["/cover.webp"] }, { photos: ["/cover.webp", "/cover.webp", ""] }])("does not request a nonexistent alternate for $photos", async ({ photos }) => {
    await render(true, photos); await advance(); expect(images()).toHaveLength(1);
  });

  it("respects reduced motion", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    await render(true); await advance(); expect(images()).toHaveLength(1);
  });

  it("respects data-saving connections", async () => {
    vi.spyOn(window, "navigator", "get").mockReturnValue({ connection: { saveData: true } } as unknown as Navigator);
    await render(true); await advance(); expect(images()).toHaveLength(1);
  });

  it("does not start image requests in a hidden tab", async () => {
    await render(true);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await advance(); expect(images()).toHaveLength(1);
  });

  it("supports browsers without decode and valid loaded images whose decode promise rejects", async () => {
    await render(true); await advance();
    await act(async () => loaded(images()[1], () => Promise.reject(new Error("Decode unavailable"))));
    expect(images()[1].className).toContain("opacity-100");
  });
});
