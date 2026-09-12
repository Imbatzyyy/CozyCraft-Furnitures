// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DialogAccessibility } from "./DialogAccessibility";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let frames: FrameRequestCallback[];
function Harness() {
  const [open, setOpen] = useState(false);
  return <><DialogAccessibility/><button id="open" onClick={() => setOpen(true)}>Open</button>{open && <section role="dialog" aria-modal="true" aria-label="Test dialog"><input id="first" aria-label="Name"/><button id="close" data-dialog-close onClick={() => setOpen(false)}>Close</button></section>}</>;
}
async function flush() { await act(async () => { await Promise.resolve(); for (const callback of frames.splice(0)) callback(0); }); }
beforeEach(() => {
  frames = []; vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; }); vi.stubGlobal("cancelAnimationFrame", vi.fn());
  // jsdom does not perform layout; visibility is supplied explicitly.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const press = (key: string, shiftKey = false) => document.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));
describe("dialog keyboard journeys", () => {
  it("contains Tab and Shift-Tab and restores keyboard focus on Escape", async () => {
    await act(async () => root.render(<Harness/>)); const opener = host.querySelector<HTMLButtonElement>("#open")!; opener.focus();
    await act(async () => opener.click()); await flush(); const dialog = host.querySelector('[role="dialog"]')!; expect(document.activeElement).toBe(dialog);
    await act(async () => press("Tab", true)); expect(document.activeElement?.id).toBe("close");
    await act(async () => press("Tab")); expect(document.activeElement?.id).toBe("first");
    await act(async () => press("Escape")); await flush(); expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(opener);
  });
  it("does not steal focus when the dialog's content updates", async () => {
    await act(async () => root.render(<Harness/>)); await act(async () => host.querySelector<HTMLButtonElement>("#open")!.click()); await flush();
    const input = host.querySelector<HTMLInputElement>("#first")!; input.focus();
    host.querySelector('[role="dialog"]')!.append(document.createElement("p")); await flush(); expect(document.activeElement).toBe(input);
  });
});
