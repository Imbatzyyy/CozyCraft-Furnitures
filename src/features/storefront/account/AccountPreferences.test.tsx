// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountPreferences } from "./AccountPreferences";

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), eq: vi.fn(), refresh: null as null | (() => void) }));
vi.mock("@/services/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ eq: (...args: unknown[]) => { mocks.eq(...args); return { maybeSingle: mocks.read }; } }), upsert: mocks.save }),
  channel: () => ({ on(_event: unknown, _filter: unknown, callback: () => void) { mocks.refresh = callback; return this; }, subscribe() { return this; } }), removeChannel: vi.fn(),
} }));
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let sequence = 0;
let owner: string;
const checks = () => [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
const saveButton = () => [...host.querySelectorAll("button")].find(button => /Save preferences|Saving/.test(button.textContent ?? ""))!;
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue({ data: { delivery_updates: true, home_circle_notes: false }, error: null }); mocks.save.mockResolvedValue({ error: null }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); owner = `preferences-test-${++sequence}`; });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.documentElement.style.fontSize = ""; });
async function mount() { await act(async () => root.render(<AccountPreferences key={owner} userId={owner}/>)); }
describe("account preference journeys", () => {
  it("loads only the signed-in owner's settings and saves explicit consent", async () => {
    await mount(); expect(mocks.eq).toHaveBeenCalledWith("user_id", owner); expect(checks().map(input => input.checked)).toEqual([true, false]); expect(saveButton().disabled).toBe(true);
    await act(async () => checks()[1].click()); await act(async () => saveButton().click());
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ user_id: owner, home_circle_notes: true, delivery_updates: true }), { onConflict: "user_id" });
    expect(host.textContent).toContain("preferences saved"); expect(saveButton().disabled).toBe(true);
  });
  it("preserves unsaved choices when realtime data arrives", async () => {
    await mount(); await act(async () => checks()[1].click());
    mocks.read.mockResolvedValue({ data: { delivery_updates: false, home_circle_notes: false }, error: null });
    await act(async () => mocks.refresh?.()); expect(checks().map(input => input.checked)).toEqual([true, true]); expect(saveButton().disabled).toBe(false);
  });
  it("offers retry without treating failed loading as saved defaults", async () => {
    mocks.read.mockResolvedValueOnce({ data: null, error: { message: "timeout" } }); await mount();
    expect(host.textContent).toContain("couldn't be loaded"); expect(saveButton().disabled).toBe(true);
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry loading")!.click());
    expect(checks()[0].checked).toBe(true);
  });
  it("retains changes after a save error and blocks duplicate submissions", async () => {
    await mount(); await act(async () => checks()[1].click()); let resolve!: (value: unknown) => void;
    mocks.save.mockImplementation(() => new Promise(done => { resolve = done; }));
    await act(async () => { saveButton().click(); saveButton().click(); }); expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ error: { message: "offline" } })); expect(host.textContent).toContain("not saved"); expect(checks()[1].checked).toBe(true); expect(saveButton().disabled).toBe(false);
  });
  it("changes browser text size without a database write", async () => {
    await mount(); await act(async () => host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[2].click());
    expect(document.documentElement.style.fontSize).toBe("20px"); expect(mocks.save).not.toHaveBeenCalled();
  });
});
