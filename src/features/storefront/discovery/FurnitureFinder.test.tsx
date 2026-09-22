// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { FurnitureFinder } from "./FurnitureFinder";
import type { Product } from "@/app/core";
vi.mock("@/app/core", () => ({ ProductCard: ({ product }: { product: Product }) => <article>{product.name}</article>, Layout: ({ children }: { children: React.ReactNode }) => children, useStore: vi.fn() }));
let root: Root, host: HTMLDivElement;
const products = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `Sofa ${i}`, category: "Living room", subcategory: "Sofa", status: "active", price: 1000, stockQuantity: 2, dimensions: "100W × 80D × 90H cm", material: "Fabric", color: "Beige", description: "Modern", images: [], reviews: 0, rating: "0", stock: "In stock" } as Product));
const mount = async (ready = true, stale = false) => act(async () => root.render(<MemoryRouter><FurnitureFinder products={products} ready={ready} stale={stale} retry={vi.fn()} /></MemoryRouter>));
const click = async (name: string) => act(async () => [...host.querySelectorAll("button")].find(el => el.textContent?.includes(name))!.click());
const choose = async () => act(async () => { const select = host.querySelector("select")!; select.value = "Sofa"; select.dispatchEvent(new Event("change", { bubbles: true })); });
beforeEach(async () => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; }); await mount(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("shows six matches per page and allows returning to the first page", async () => {
  await choose(); await click("Find my furniture"); expect(host.querySelectorAll("article")).toHaveLength(6);
  await click("Next"); expect(host.querySelectorAll("article")).toHaveLength(2); expect(host.textContent).toContain("Page 2 of 2");
  await click("Previous"); expect(host.querySelectorAll("article")).toHaveLength(6);
});
it("does not match a loading or stale catalog", async () => {
  await mount(false); expect(host.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
  await mount(true, true); expect(host.textContent).toContain("refreshed"); expect(host.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
});
it("resets the shortlist only with the reset action", async () => {
  await choose(); await click("Find my furniture"); await click("Reset preferences");
  expect(host.querySelectorAll("article")).toHaveLength(0); expect(host.textContent).toContain("A more personal way");
});
