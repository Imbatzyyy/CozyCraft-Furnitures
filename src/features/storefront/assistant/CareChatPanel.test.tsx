// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CareChatPanel } from "./CareChatPanel";
import { askCare } from "./assistant.service";
import { conversationKey, persistConversation, readConversation, replyBlocks } from "./conversation";
vi.mock("./assistant.service", () => ({ askCare: vi.fn() }));
let root: Root, host: HTMLDivElement;
const button = (name: string) => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(b => b.getAttribute("aria-label") === name || b.textContent?.includes(name))!;
const click = async (name: string) => { await act(async () => { button(name).click(); }); };
const draft = async (value: string) => { await act(async () => { const el = document.querySelector("textarea")!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); }); };
const mount = async (ownerId: string | null = null) => { await act(async () => { root.render(<MemoryRouter><CareChatPanel key={ownerId ?? "guest"} ownerId={ownerId} currentPath="/profile?tab=home-circle" /></MemoryRouter>); }); };
beforeEach(async () => { vi.mocked(askCare).mockReset(); sessionStorage.clear(); Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); await mount(); });
afterEach(async () => { await act(async () => { root.unmount(); }); host.remove(); vi.useRealTimers(); });
describe("CozyCraft Care interactions", () => {
  it("opens without spending a health-check request; Escape restores the launcher", async () => {
    await click("Open CozyCraft chat"); expect(askCare).not.toHaveBeenCalled(); expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    await act(async () => { document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(button("Open CozyCraft chat"));
  });
  it("renders plain steps and labelled links instead of raw markdown", async () => {
    vi.mocked(askCare).mockResolvedValue({ message: { from: "care", text: "**Your voucher**\n\n1. Open Home Circle.\n2. Confirm the exchange.", actions: [{ label: "Open Home Circle", href: "/profile?tab=home-circle" }] }, retryAfter: 0 });
    await click("Open CozyCraft chat"); await draft("How do I convert points to vouchers?"); await click("Send message");
    expect(document.querySelectorAll(".care-reply ol li")).toHaveLength(2); expect(document.querySelector(".care-transcript")!.textContent).not.toContain("**"); expect(document.querySelector('.care-actions a')!.getAttribute("href")).toBe("/profile?tab=home-circle");
    expect(askCare).toHaveBeenCalledTimes(1); expect(vi.mocked(askCare).mock.calls[0][0].currentPath).toBe("/profile?tab=home-circle");
  });
  it("locks duplicate submissions before React finishes rerendering", async () => {
    vi.mocked(askCare).mockImplementation(() => new Promise(() => {})); await click("Open CozyCraft chat"); await draft("Track my order");
    await act(async () => { const form = document.querySelector(".care-composer")!; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(askCare).toHaveBeenCalledTimes(1);
  });
  it("offers an explicit retry without re-appending the customer message or retrying automatically", async () => {
    vi.mocked(askCare).mockRejectedValueOnce(new Error("Connection failed")).mockResolvedValueOnce({ message: { from: "care", text: "Please open Orders." }, retryAfter: 0 });
    await click("Open CozyCraft chat"); await draft("Track my order"); await click("Send message"); expect(askCare).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alert"]')!.textContent).toContain("Connection failed"); await click("Retry message"); expect(askCare).toHaveBeenCalledTimes(2); expect(document.querySelectorAll(".care-message-you")).toHaveLength(1);
  });
  it("does not transmit or persist an obvious OTP", async () => {
    await click("Open CozyCraft chat"); await draft("my OTP is 123456"); await click("Send message"); expect(askCare).not.toHaveBeenCalled(); expect(document.querySelectorAll(".care-message-you")).toHaveLength(0); expect(sessionStorage.getItem(conversationKey("guest"))).not.toContain("123456");
  });
  it("keeps offline drafts and makes no background requests", async () => {
    await click("Open CozyCraft chat"); await draft("Help with my order"); await act(async () => { Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); window.dispatchEvent(new Event("offline")); }); expect(button("Send message").disabled).toBe(true); expect(document.querySelector("textarea")!.value).toBe("Help with my order"); expect(askCare).not.toHaveBeenCalled();
  });
  it("abandons old-owner responses when the account changes", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof askCare>>) => void;
    vi.mocked(askCare).mockImplementation(() => new Promise(done => { resolve = done; })); await click("Open CozyCraft chat"); await draft("Track my order"); await click("Send message"); await mount("new-owner");
    await act(async () => { resolve({ message: { from: "care", text: "OLD PRIVATE ORDER" }, retryAfter: 0 }); }); await click("Open CozyCraft chat"); expect(document.body.textContent).not.toContain("OLD PRIVATE ORDER");
  });
  it("requires a deliberate choice before clearing a conversation", async () => { await click("Open CozyCraft chat"); await draft("unsent draft"); await click("New conversation"); expect(document.body.textContent).toContain("Clear this conversation"); await click("Keep conversation"); expect(document.querySelector("textarea")!.value).toBe("unsent draft"); await click("New conversation"); await click("Start new"); expect(document.querySelector("textarea")!.value).toBe(""); });
  it("releases a stuck request with a visible timeout", async () => {
    vi.useFakeTimers(); vi.mocked(askCare).mockImplementation(() => new Promise(() => {})); await click("Open CozyCraft chat"); await draft("Track my order"); await click("Send message"); await act(async () => { await vi.advanceTimersByTimeAsync(32000); }); expect(document.querySelector('[role="alert"]')!.textContent).toContain("took too long"); expect(button("Retry message").disabled).toBe(false);
  });
});
describe("Tab-only conversation handling", () => {
  it("keeps accounts separate and does not restore old-format context", () => { persistConversation(conversationKey("one"), [{ from: "you", text: "my order" }]); expect(readConversation(conversationKey("two"))[0].text).not.toBe("my order"); });
  it("expires saved context and tolerates invalid storage", () => { const key = conversationKey("guest"); sessionStorage.setItem(key, "{broken"); expect(readConversation(key)[0].from).toBe("care"); sessionStorage.setItem(key, JSON.stringify({ at: Date.now()-7*3600000, messages: [{from:"you",text:"old message"}] })); expect(readConversation(key)[0].text).not.toBe("old message"); });
  it("formats paragraphs and lists without HTML rendering", () => { expect(replyBlocks("Hello\n\n1. One\n2. Two")).toEqual([{kind:"paragraph",lines:["Hello"]},{kind:"steps",lines:["One","Two"]}]); });
});
