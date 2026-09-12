import { afterEach, describe, expect, it, vi } from "vitest";
import { readOfflineCatalog, saveOfflineCatalog } from "./offline-catalog";
import { localStore } from "@/lib/shared/browser-storage";
import type { Product } from "@/app/core";
const key = "cozycraft-public-catalog-v1";
afterEach(() => { localStore.removeItem(key); vi.useRealTimers(); });
describe("public offline catalog", () => {
  it("caches active public products only", () => {
    const products = [{ id: "public", name: "Sofa", status: "active", images: [] }, { id: "hidden", name: "Hidden", status: "inactive", images: [] }] as unknown as Product[];
    saveOfflineCatalog(products); expect(readOfflineCatalog().map(product => product.id)).toEqual(["public"]);
  });
  it("expires snapshots and ignores corrupt timestamps or payloads", () => {
    vi.useFakeTimers(); const now = Date.now();
    saveOfflineCatalog([{ id: "public", name: "Sofa", status: "active", images: [] }] as unknown as Product[]);
    vi.setSystemTime(now + 7 * 86_400_000 + 1); expect(readOfflineCatalog()).toEqual([]);
    localStore.setItem(key, JSON.stringify({ products: [{ id: "public", name: "Sofa", status: "active", images: [] }] })); expect(readOfflineCatalog()).toEqual([]);
    localStore.setItem(key, "bad json"); expect(readOfflineCatalog()).toEqual([]);
  });
});
