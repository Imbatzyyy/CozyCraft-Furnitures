// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { usePendingEmail } from "./pending-email";
import { sessionStore } from "@/lib/shared/browser-storage";
let api: ReturnType<typeof usePendingEmail>;
const confirm = vi.fn().mockResolvedValue({ confirmed: false, error: null });
const done = vi.fn();
function Harness({ id }: { id: string | null }) { api = usePendingEmail(id, confirm, done); return <div>{api.pendingEmail}</div>; }
let root: ReturnType<typeof createRoot>;
afterEach(async () => { await act(async () => root?.unmount()); sessionStore.clear(); confirm.mockClear(); done.mockClear(); vi.useRealTimers(); });
it("does not crash for a signed-out customer", async () => { root = createRoot(document.createElement("div")); await act(async () => root.render(<Harness id={null}/>)); expect(api.pendingEmail).toBeNull(); });
it("has no timed polling and does not expose the previous account's pending email", async () => {
  vi.useFakeTimers(); root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness id="a"/>));
  await act(async () => api.setPendingEmail("new@example.test")); expect(confirm).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(300_000)); expect(confirm).toHaveBeenCalledTimes(1);
  await act(async () => window.dispatchEvent(new Event("focus"))); expect(confirm).toHaveBeenCalledTimes(2);
  await act(async () => root.render(<Harness id="b"/>)); expect(api.pendingEmail).toBeNull();
});
