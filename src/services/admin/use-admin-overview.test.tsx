// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ADMIN_DATA_CHANGED } from "@/lib/admin/workspace-events";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/services/supabase/client", () => ({ adminSupabase: { rpc: mock.rpc } }));
import { useAdminOverview } from "./use-admin-overview";
import { useAttentionCounts } from "./use-attention-counts";

let root: Root;
let host: HTMLDivElement;
let state: ReturnType<typeof useAdminOverview<{ pending: number }>>;
let visibility = "visible";
const requests: Array<{ resolve: (value: unknown) => void; signal: AbortSignal }> = [];
function Overview({ owner = "a", enabled = true }) {
  state = useAdminOverview<{ pending: number }>(owner, enabled);
  return <div>{state.data?.pending ?? "empty"}</div>;
}
function Badges({ owner = "a", enabled = true }) {
  const data = useAttentionCounts(owner, enabled);
  return <span>{data?.pending ?? "empty"}</span>;
}
const advance = (ms = 200) => act(() => vi.advanceTimersByTimeAsync(ms));
const change = () => act(() => window.dispatchEvent(new Event(ADMIN_DATA_CHANGED)));
const resolve = (index: number, pending: number) => act(() => requests[index].resolve({ data: { pending }, error: null }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility as DocumentVisibilityState);
  requests.length = 0;
  mock.rpc.mockImplementation(() => ({ abortSignal: (signal: AbortSignal) => new Promise((resolve, reject) => {
    requests.push({ resolve, signal });
    signal.addEventListener("abort", () => reject(new Error("Request timed out")), { once: true });
  }) }));
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  vi.useRealTimers(); vi.restoreAllMocks(); mock.rpc.mockReset();
});
it("shares one summary in StrictMode and does not lose an early event", async () => {
  await act(() => root.render(<StrictMode><Overview/><Badges/></StrictMode>));
  await advance(); expect(requests).toHaveLength(1);
  await resolve(0, 0); expect(host.textContent).toBe("00");
  await advance(1000); await change(); await advance();
  expect(requests).toHaveLength(2);
  await resolve(1, 1); expect(host.textContent).toBe("11");
  await advance(120_000); expect(requests).toHaveLength(2); // no polling
});
it("coalesces bursts and queues a trailing read while a request is running", async () => {
  await act(() => root.render(<><Overview/><Badges/></>));
  await advance();
  for (let i = 0; i < 8; i++) { await change(); await advance(25); }
  expect(requests).toHaveLength(1);
  await resolve(0, 1); await advance(); expect(requests).toHaveLength(2);
  await resolve(1, 2); expect(host.textContent).toBe("22");
});
it("defers hidden work, recovers on return and coalesces reconnect signals", async () => {
  await act(() => root.render(<Overview/>));
  await advance(); await resolve(0, 1);
  await change(); visibility = "hidden"; await advance(5000);
  await change(); expect(requests).toHaveLength(1);
  visibility = "visible";
  await act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online"));
  });
  await advance(); expect(requests).toHaveLength(2);
  await resolve(1, 3); expect(host.textContent).toBe("3");
});
it("retains the last good value on timeout and can recover online", async () => {
  await act(() => root.render(<Overview/>));
  await advance(); await resolve(0, 1);
  await change(); await advance(); await advance(12_000);
  expect(requests[1].signal.aborted).toBe(true);
  expect(state.error).toBe("Request timed out"); expect(host.textContent).toBe("1");
  await act(() => window.dispatchEvent(new Event("online"))); await advance();
  await resolve(2, 2); expect(state.error).toBe(""); expect(host.textContent).toBe("2");
});
it("isolates identities, aborts on logout and never shows data while disabled", async () => {
  await act(() => root.render(<><Overview/><Badges/></>));
  await advance(); await resolve(0, 5);
  await change(); await advance();
  await act(() => root.render(<><Overview owner="b"/><Badges owner="b"/></>));
  expect(host.textContent).toBe("emptyempty"); expect(requests[1].signal.aborted).toBe(true);
  await resolve(1, 99); expect(host.textContent).toBe("emptyempty");
  await advance(); await resolve(2, 7); expect(host.textContent).toBe("77");
  await act(() => root.render(<><Overview owner="b" enabled={false}/><Badges owner="b" enabled={false}/></>));
  expect(host.textContent).toBe("emptyempty");
  await change(); await advance(60_000); expect(requests).toHaveLength(3);
});
