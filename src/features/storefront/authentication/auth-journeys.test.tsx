// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Account } from "./CustomerAuth";

const mocks = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock("@/services/supabase/client", () => ({ supabase: { auth: { resetPasswordForEmail: mocks.reset } } }));
vi.mock("@/app/core", () => ({ Logo: () => <span>CozyCraft</span>, Layout: ({ children }: { children: ReactNode }) => <>{children}</>, useStore: () => ({ authReady: true, user: null, role: null, signOut: vi.fn(), storeSettings: { account_settings: { password_minimum_length: 8 } } }) }));
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
beforeEach(() => { mocks.reset.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(initialView: "auth" | "forgot") { await act(async () => root.render(<MemoryRouter initialEntries={[initialView === "forgot" ? "/forgot-password" : "/login"]}><Account mode="login" initialView={initialView}/></MemoryRouter>)); }
describe("customer auth journeys", () => {
  it("opens the recovery form directly and can return to sign in", async () => {
    await render("forgot"); expect(host.textContent).toContain("Send reset link"); expect(host.querySelector('input[type="email"]')).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(host.textContent).toContain("Keep me signed in");
  });
  it("keeps the remember-me checkbox controlled through rerenders", async () => {
    await render("auth"); const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(false); await act(async () => checkbox.click()); expect(checkbox.checked).toBe(true);
    await render("auth"); expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
  });
  it("blocks duplicate recovery submissions and recovers from a network error", async () => {
    let reject!: (reason: unknown) => void; mocks.reset.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    await render("forgot");
    const form = host.querySelector("form")!;
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(mocks.reset).toHaveBeenCalledTimes(1); expect(host.textContent).toContain("Sending reset link");
    await act(async () => reject(new Error("offline"))); expect(host.textContent).toContain("Check your connection");
    expect([...host.querySelectorAll("button")].find(button => button.textContent === "Send reset link")?.disabled).toBe(false);
  });
});
