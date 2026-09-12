// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentManagementPage } from "./ContentManagement";
import { sessionStore } from "@/lib/shared/browser-storage";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), tables: [] as string[], on: vi.fn() }));
vi.mock("@/app/core", () => ({ useAdminSession: () => ({ userId: "content-test-admin" }) }));
vi.mock("@/features/admin/shell/AdminShell", () => ({ AdminShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/admin/content/NewsletterManagement", () => ({ NewsletterManagement: () => null }));
vi.mock("@/services/supabase/client", () => ({ adminSupabase: {
  from: (table: string) => { mocks.tables.push(table); return {
    select: () => ({ order: () => Promise.resolve({ data: table === "content_pages" ? [{ slug: "faq", title: "FAQ", summary: "", eyebrow: "Help", body: "", published: true, updated_at: "1" }] : [], error: null }) }),
    insert: (value: unknown) => { mocks.insert(value); return { select: () => ({ single: () => Promise.resolve({ data: { ...(value as object), updated_at: "2" }, error: null }) }) }; },
    update: mocks.update,
  }; },
  channel: () => ({ on(...args: unknown[]) { mocks.on(...args); return this; }, subscribe() { return this; } }), removeChannel: vi.fn(),
} }));
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
const button = (name: string) => [...host.querySelectorAll("button")].find(button => button.textContent === name)!;
async function input(label: string, value: string) {
  const field = [...host.querySelectorAll("label")].find(node => node.textContent?.startsWith(label))!.querySelector("input")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
}
beforeEach(() => { vi.clearAllMocks(); mocks.tables.length = 0; sessionStore.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStore.clear(); });
describe("admin content journeys", () => {
  it("loads and subscribes only to the visible content section", async () => {
    await act(async () => root.render(<ContentManagementPage/>)); expect(mocks.tables).toEqual(["content_pages"]);
    expect(mocks.on).toHaveBeenLastCalledWith("postgres_changes", expect.objectContaining({ table: "content_pages" }), expect.any(Function));
    await act(async () => button("Homepage").click()); expect(mocks.tables).toEqual(["content_pages", "homepage_banners"]);
  });
  it("inserts a newly created banner instead of trying to update a nonexistent row", async () => {
    await act(async () => root.render(<ContentManagementPage/>)); await act(async () => button("Homepage").click());
    await act(async () => button("New banner").click());
    await input("Headline", "A new collection"); await input("Image URL", "https://example.test/banner.jpg");
    await act(async () => button("Save banner").click());
    expect(mocks.insert).toHaveBeenCalledTimes(1); expect(mocks.update).not.toHaveBeenCalled(); expect(host.textContent).toContain("Homepage banner saved");
    expect(host.textContent).not.toContain("You have unsaved edits");
  });
});
