// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Layout, StoreContext, type Store } from "@/app/core";
import { defaultStoreSettings } from "@/lib/settings/store-settings";
import { CATALOG_STALE_EVENT, setCatalogStale } from "@/lib/catalog/offline-catalog";

vi.mock("@/features/storefront/assistant/CareChatPanel", () => ({ CareChatPanel: () => null }));
vi.mock("@/services/supabase/client", () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } },
}));

let host: HTMLDivElement, root: Root, online: boolean;
beforeEach(() => {
  online = true;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  setCatalogStale(false);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); setCatalogStale(false);
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

async function mount({ immersive = true, announcement = false } = {}) {
  const store = {
    storeSettings: { ...defaultStoreSettings, announcement_enabled: announcement, announcement_text: "Class delivery information" },
    cart: [], saved: [], products: [], orders: [], userId: null, user: null,
    profileUsername: "", avatar: null, authReady: true, role: null,
  } as unknown as Store;
  await act(async () => root.render(<MemoryRouter initialEntries={["/home"]}><StoreContext.Provider value={store}><Layout immersive={immersive}><main>Page content</main></Layout></StoreContext.Provider></MemoryRouter>));
}
const header = () => host.querySelector("header.cc-header")!;
const notice = () => host.querySelector('[aria-label="Shopping connection"]');
const expectSafeHeader = () => {
  expect(header().classList.contains("sticky")).toBe(true);
  expect(header().classList.contains("fixed")).toBe(false);
  expect(header().classList.contains("bg-[#f7f5f1]")).toBe(true);
  expect(header().classList.contains("bg-gradient-to-b")).toBe(false);
  expect(header().compareDocumentPosition(notice()!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
};

describe("storefront connection notice and navigation", () => {
  it("preserves the immersive header when the catalog is live", async () => {
    await mount(); expect(notice()).toBeNull(); expect(header().classList.contains("fixed")).toBe(true);
  });
  it("uses in-flow opaque navigation when saved data is already active at mount", async () => {
    setCatalogStale(true); await mount(); expectSafeHeader();
    expect(notice()?.textContent).toContain("Showing a saved catalog.");
  });
  it("updates navigation and the notice together after asynchronous failure and recovery", async () => {
    await mount(); await act(async () => setCatalogStale(true)); expectSafeHeader();
    await act(async () => setCatalogStale(false));
    expect(notice()).toBeNull(); expect(header().classList.contains("fixed")).toBe(true);
  });
  it("keeps offline and stale notices below navigation until the catalog really recovers", async () => {
    await mount(); await act(async () => { online = false; window.dispatchEvent(new Event("offline")); });
    expectSafeHeader(); expect(notice()?.textContent).toContain("You're offline.");
    expect(notice()?.querySelector("button")).toBeNull();
    await act(async () => { setCatalogStale(true); online = true; window.dispatchEvent(new Event("online")); });
    expectSafeHeader(); expect(notice()?.textContent).toContain("Showing a saved catalog.");
  });
  it("rechecks restored pages without a network request or polling", async () => {
    await mount(); await act(async () => { online = false; window.dispatchEvent(new Event("pageshow")); });
    expectSafeHeader(); expect(notice()?.textContent).toContain("You're offline.");
  });
  it("leaves retry wired to the existing catalog refresh without prematurely hiding the notice", async () => {
    setCatalogStale(true); await mount(); const retry = vi.fn(); window.addEventListener("cozycraft:refresh-catalog", retry);
    try { await act(async () => notice()!.querySelector("button")!.click()); expect(retry).toHaveBeenCalledOnce(); expectSafeHeader(); }
    finally { window.removeEventListener("cozycraft:refresh-catalog", retry); }
  });
  it("handles the additional store announcement without hardcoded spacer heights", async () => {
    setCatalogStale(true); await mount({ announcement: true }); expectSafeHeader();
    expect(header().querySelector('[aria-label="Store announcement"]')).not.toBeNull();
  });
  it("keeps ordinary pages opaque and in flow even after recovery", async () => {
    await mount({ immersive: false }); await act(async () => setCatalogStale(true)); expectSafeHeader();
    await act(async () => setCatalogStale(false)); expect(header().classList.contains("sticky")).toBe(true);
    expect(header().className).not.toContain("backdrop-blur");
  });
  it("unsubscribes from connection signals on unmount", async () => {
    const remove = vi.spyOn(window, "removeEventListener"); await mount();
    await act(async () => root.render(null));
    for (const event of ["online", "offline", "pageshow", CATALOG_STALE_EVENT]) expect(remove.mock.calls.some(([name]) => name === event)).toBe(true);
  });
});
