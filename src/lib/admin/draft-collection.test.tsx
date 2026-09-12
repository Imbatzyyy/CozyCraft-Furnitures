// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useDraftCollection } from "./draft-collection";
import { sessionStore } from "@/lib/shared/browser-storage";

type Row = { id: string; title: string; updated_at: string };
let api: ReturnType<typeof useDraftCollection<Row>>;
function Harness({ storageKey }: { storageKey?: string }) { api = useDraftCollection<Row>(row => row.id, storageKey); return <div>{api.rows.map(row => row.title).join(",")}</div>; }
const roots: ReturnType<typeof createRoot>[] = [];
async function mount(storageKey?: string) { const el = document.createElement("div"); document.body.append(el); const root = createRoot(el); roots.push(root); await act(async () => root.render(<Harness storageKey={storageKey}/>)); }
afterEach(async () => { for (const root of roots.splice(0)) await act(async () => root.unmount()); document.body.innerHTML = ""; });
describe("admin draft preservation", () => {
  it("merges live updates without overwriting unsaved content", async () => {
    await mount(); await act(async () => api.refresh([{ id: "1", title: "Saved", updated_at: "1" }]));
    await act(async () => api.setRows(rows => rows.map(row => ({ ...row, title: "Unsaved" }))));
    await act(async () => api.refresh([{ id: "1", title: "Other admin", updated_at: "2" }, { id: "2", title: "New record", updated_at: "1" }]));
    expect(api.rows.map(row => row.title)).toEqual(["Unsaved", "New record"]); expect(api.dirty).toBe(true);
  });
  it("preserves typing that happens while a save is pending", async () => {
    await mount(); await act(async () => api.refresh([{ id: "1", title: "Saved", updated_at: "1" }]));
    await act(async () => api.setRows(rows => rows.map(row => ({ ...row, title: "First edit" })))); const submitted = api.rows[0];
    await act(async () => api.setRows(rows => rows.map(row => ({ ...row, title: "Second edit" }))));
    await act(async () => api.saved(submitted, { ...submitted, updated_at: "2" }));
    expect(api.rows[0]).toMatchObject({ title: "Second edit", updated_at: "2" }); expect(api.dirty).toBe(true);
  });
  it("clears only the saved draft and preserves new banners on refresh", async () => {
    await mount(); await act(async () => api.setRows([{ id: "new", title: "New banner", updated_at: "" }]));
    await act(async () => api.refresh([])); expect(api.rows).toHaveLength(1);
    const submitted = api.rows[0]; await act(async () => api.saved(submitted, { ...submitted, updated_at: "2" })); expect(api.dirty).toBe(false);
  });
  it("recovers same-account drafts after remount without leaking them to another account", async () => {
    const key = "test-content:admin-a"; sessionStore.removeItem(key);
    await mount(key); await act(async () => api.setRows([{ id: "new", title: "Keep this draft", updated_at: "" }]));
    await mount("test-content:admin-b"); expect(api.rows).toEqual([]);
    await mount(key); expect(api.rows[0].title).toBe("Keep this draft");
    await act(async () => api.discard()); expect(sessionStore.getItem(key)).toBeNull(); expect(api.rows).toEqual([]);
  });
  it("ignores expired or corrupt recovery data", async () => {
    sessionStore.setItem("test-expired", JSON.stringify({ at: Date.now() - 86_400_001, rows: [{ id: "1", title: "old", updated_at: "1" }] }));
    await mount("test-expired"); expect(api.rows).toEqual([]);
    sessionStore.setItem("test-corrupt", "bad json"); await mount("test-corrupt"); expect(api.rows).toEqual([]);
  });
});
