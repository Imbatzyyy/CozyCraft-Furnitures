// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStickyHold } from "./motion";
import { ProductMeasurements } from "../catalog/ProductMeasurements";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let sticky = true;
let top = -120;
const specs = [
  { label: "Width", value: "80", unit: "cm" },
  { label: "Depth", value: "30", unit: "cm" },
  { label: "Height", value: "179", unit: "cm" },
];

function Fixture() {
  const gallery = useStickyHold<HTMLDivElement>();
  return <div>
    <div ref={gallery.ref}><img src="/product.jpg" alt="Product photo" data-loaded="" /></div>
    <section><h1>Product title</h1><div onClickCapture={(event) => {
      if ((event.target as Element).closest("summary")) gallery.hold();
    }}>
      <details className="cc-accordion"><summary>Dimensions &amp; fit<svg><path /></svg></summary>
        <ProductMeasurements specs={specs} name="IVAR" type="Wine Storage Cabinet" />
        <label>Room width<input defaultValue="300" /></label>
      </details>
    </div></section>
  </div>;
}

beforeEach(async () => {
  sticky = true; top = -120;
  vi.stubGlobal("getComputedStyle", () => ({ position: sticky ? "sticky" : "static", top: "96px" }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ top }) as DOMRect);
  Object.defineProperty(window, "scrollY", { configurable: true, value: 800 });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Fixture />));
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

describe("product disclosure stability", () => {
  it("preserves the same image, title, sketch and fit input across repeated native toggles", async () => {
    const image = host.querySelector("img");
    const title = host.querySelector("h1");
    const sketch = host.querySelector("figure svg");
    const input = host.querySelector("input");
    const details = host.querySelector("details")!;
    const summary = details.querySelector("summary")!;
    for (let i = 0; i < 12; i++) {
      await act(async () => summary.click());
      expect(details.open).toBe(i % 2 === 0);
      expect(host.querySelector("img")).toBe(image);
      expect(image?.getAttribute("data-loaded")).toBe("");
      expect(host.querySelector("h1")).toBe(title);
      expect(host.querySelector("figure svg")).toBe(sketch);
      expect(host.querySelector("input")).toBe(input);
      expect(input?.value).toBe("300");
    }
  });

  it("holds a bottom-constrained desktop gallery even when the summary icon is clicked", async () => {
    await act(async () => host.querySelector("summary path")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const gallery = host.querySelector("img")!.parentElement!;
    expect(gallery.style.top).toBe("-120px");
    expect(gallery.dataset.stickyTop).toBe("96");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 584 });
    await act(async () => window.dispatchEvent(new Event("scroll")));
    expect(gallery.style.top).toBe("");
    expect(gallery.dataset.stickyTop).toBeUndefined();
  });

  it("does not set a sticky override for mobile layouts or an already-pinned gallery", async () => {
    sticky = false;
    await act(async () => host.querySelector("summary")!.click());
    const gallery = host.querySelector("img")!.parentElement!;
    expect(gallery.style.top).toBe("");
    sticky = true; top = 96;
    await act(async () => host.querySelector("summary")!.click());
    expect(gallery.style.top).toBe("");
  });

  it("clears the desktop hold at a responsive resize", async () => {
    await act(async () => host.querySelector("summary")!.click());
    const gallery = host.querySelector("img")!.parentElement!;
    expect(gallery.style.top).toBe("-120px");
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(gallery.style.top).toBe("");
    expect(gallery.dataset.stickyTop).toBeUndefined();
  });
});
