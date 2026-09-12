// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaticContentPage } from "./StorefrontCatalog";

const mocks = vi.hoisted(() => ({ load: vi.fn(), cached: vi.fn() }));
vi.mock("@/services/content/content.service", () => ({ getContentPage: mocks.load, getCachedContentPage: mocks.cached, clearContentCache: vi.fn() }));
vi.mock("@/app/core", () => ({ Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>, useStore: () => ({ storeSettings: { contact_email: "test@example.test" } }) }));
vi.mock("@/services/supabase/client", () => ({ supabase: { channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn() } }));
let navigate: ReturnType<typeof useNavigate>;
function Harness() { navigate = useNavigate(); return <StaticContentPage/>; }
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
const page = (slug: string, title: string) => ({ slug, title, summary: "Helpful information", eyebrow: "Help", body: "", published: true, updated_at: "2026-09-12" });
beforeEach(() => { mocks.load.mockReset(); mocks.cached.mockReturnValue(null); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe("information page journeys", () => {
  it("ignores a previous page response after navigating to FAQ", async () => {
    let resolveContact!: (value: unknown) => void;
    mocks.load.mockImplementation((slug: string) => slug === "contact" ? new Promise(resolve => { resolveContact = resolve; }) : Promise.resolve(page("faq", "FAQ current")));
    await act(async () => root.render(<MemoryRouter initialEntries={["/contact"]}><Harness/></MemoryRouter>));
    await act(async () => navigate("/faq")); expect(host.textContent).toContain("FAQ current");
    await act(async () => resolveContact(page("contact", "Old contact response")));
    expect(host.textContent).toContain("FAQ current"); expect(host.textContent).not.toContain("Old contact response");
  });
  it("offers retry after failure and renders recovered content", async () => {
    mocks.load.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(page("faq", "Recovered FAQ"));
    await act(async () => root.render(<MemoryRouter initialEntries={["/faq"]}><Harness/></MemoryRouter>));
    expect(host.textContent).toContain("Try again");
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click()); expect(host.textContent).toContain("Recovered FAQ");
  });
  it("labels cached content honestly when the live request fails", async () => {
    mocks.cached.mockReturnValue(page("faq", "Saved FAQ")); mocks.load.mockRejectedValue(new Error("offline"));
    await act(async () => root.render(<MemoryRouter initialEntries={["/faq"]}><Harness/></MemoryRouter>));
    expect(host.textContent).toContain("Saved FAQ"); expect(host.textContent).toContain("Showing saved information"); expect(host.textContent).toContain("Try again");
  });
});
