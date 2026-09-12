import { afterEach, describe, expect, it, vi } from "vitest";
import { resilientStorage } from "./browser-storage";
import { createCustomerAuthStorage } from "@/lib/auth/auth-persistence";
import { parsePendingEmail } from "@/lib/auth/pending-email";
import { isHeicPhoto, prepareCustomerPhoto } from "./prepare-photo";
import { resilientFetch } from "./network";

const memory = () => resilientStorage(() => null);
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("storage resilience and session retention", () => {
  it("survives blocked storage getters, writes and reads", () => {
    const storage = resilientStorage(() => { throw new Error("denied"); });
    storage.setItem("item", "value"); expect(storage.getItem("item")).toBe("value");
    storage.removeItem("item"); expect(storage.getItem("item")).toBeNull();
  });
  it("does not resurrect a deleted value after storage recovers", () => {
    const disk = memory(); disk.setItem("item", "old"); let blocked = false;
    const storage = resilientStorage(() => { if (blocked) throw new Error("denied"); return disk; });
    expect(storage.getItem("item")).toBe("old"); blocked = true; storage.removeItem("item"); blocked = false;
    expect(storage.getItem("item")).toBeNull();
  });
  it("keeps unchecked sign-in in the current tab only", () => {
    const local = memory(), session = memory(); const auth = createCustomerAuthStorage(local, session, "auth");
    auth.setPersistent(false); auth.setItem("auth", "token");
    expect(local.getItem("auth")).toBeNull(); expect(session.getItem("auth")).toBe("token");
    expect(createCustomerAuthStorage(local, memory(), "auth").getItem("auth")).toBeNull();
    expect(createCustomerAuthStorage(local, session, "auth").getItem("auth")).toBe("token");
  });
  it("persists checked sign-in and clears both stores on sign-out", () => {
    const local = memory(), session = memory(); const auth = createCustomerAuthStorage(local, session, "auth");
    auth.setPersistent(true); auth.setItem("auth", "token");
    expect(createCustomerAuthStorage(local, memory(), "auth").getItem("auth")).toBe("token");
    auth.removeItem("auth"); expect(local.getItem("auth")).toBeNull(); expect(session.getItem("auth")).toBeNull();
  });
  it("moves customer PKCE/session values without touching admin authentication", () => {
    const local = memory(), session = memory(); local.setItem("admin", "private");
    const auth = createCustomerAuthStorage(local, session, "customer"); auth.setItem("customer-code-verifier", "proof");
    auth.setPersistent(false); expect(local.getItem("customer-code-verifier")).toBeNull(); expect(session.getItem("customer-code-verifier")).toBe("proof"); expect(local.getItem("admin")).toBe("private");
  });
});
describe("account-scoped pending email", () => {
  const raw = JSON.stringify({ owner: "a", email: "a@example.com", expiresAt: 2000 });
  it("accepts a valid unexpired record for its owner", () => expect(parsePendingEmail(raw, "a", 1000)?.email).toBe("a@example.com"));
  it("rejects other accounts, expired records and corrupt data", () => {
    expect(parsePendingEmail(raw, "b", 1000)).toBeNull(); expect(parsePendingEmail(raw, "a", 3000)).toBeNull(); expect(parsePendingEmail("oops", "a")).toBeNull();
  });
});
describe("bounded reads and offline writes", () => {
  it("does not send mutations while offline", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); vi.stubGlobal("navigator", { onLine: false });
    await expect(resilientFetch("https://example.test", { method: "POST" })).rejects.toThrow("offline"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("aborts a stalled read after twelve seconds", async () => {
    vi.useFakeTimers(); vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))))));
    const result = resilientFetch("https://example.test"); const expectation = expect(result).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(12001); await expectation;
  });
  it("does not replace or time out payment-write signals", async () => {
    const signal = new AbortController().signal; const fetcher = vi.fn().mockResolvedValue(new Response("ok")); vi.stubGlobal("fetch", fetcher);
    await resilientFetch("https://example.test", { method: "POST", signal }); expect(fetcher.mock.calls[0][1].signal).toBe(signal);
  });
});
describe("photo input validation", () => {
  it("recognizes iPhone formats including missing MIME types", () => { expect(isHeicPhoto({ name: "photo.HEIC", type: "" })).toBe(true); expect(isHeicPhoto({ name: "photo", type: "image/heif" })).toBe(true); });
  it("rejects oversized or unsupported files before conversion", async () => {
    await expect(prepareCustomerPhoto({ size: 6 * 1024 * 1024 } as File)).rejects.toThrow("5 MB");
    await expect(prepareCustomerPhoto({ size: 1, name: "x.svg", type: "image/svg+xml" } as File)).rejects.toThrow("Choose a JPG");
  });
});
