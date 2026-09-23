// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { FurnitureFinder } from "./FurnitureFinder";
import { blankIntent } from "../../../../supabase/functions/_shared/furniture-discovery";
import type { Product } from "@/app/core";
const mocks = vi.hoisted(() => ({ interpret: vi.fn() }));
vi.mock("./discovery.service", () => ({
  interpretFurniture: mocks.interpret,
  loadVisualProfiles: vi.fn(),
}));
vi.mock("@/app/core", () => ({
  ProductCard: ({ product }: { product: Product }) => <div>{product.name}</div>,
}));
const product = {
  id: "test",
  name: "Test Grey Sofa",
  subcategory: "2-Seater Fabric Sofa",
  category: "Living room",
  color: "grey",
  material: "Fabric: Polyester",
  price: 5000,
  status: "active",
  stockQuantity: 2,
  stock: "In stock",
  rating: "0",
  reviews: 0,
  description: "A grey two-seater fabric sofa.",
  images: [],
  dimensions: "120W × 80D × 85H cm",
} as Product;
let root: ReturnType<typeof createRoot>, host: HTMLDivElement;
beforeEach(() => {
  mocks.interpret.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const render = async () => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FurnitureFinder
          products={[product]}
          ready
          stale={false}
          retry={() => {}}
        />
      </MemoryRouter>,
    ),
  );
};
const text = async (value: string) => {
  await act(async () => {
    const textarea = host.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const submit = async () => {
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
};
describe("photo-aware finder interactions", () => {
  it("keeps pagination at six products and allows going back", async () => {
    const products = Array.from({ length: 8 }, (_, i) => ({
      ...product,
      id: String(i),
      name: `Paginated Sofa ${i}`,
    }));
    await act(async () =>
      root.render(
        <MemoryRouter>
          <FurnitureFinder
            products={products}
            ready
            stale={false}
            retry={() => {}}
          />
        </MemoryRouter>,
      ),
    );
    await submit();
    expect(host.querySelectorAll(".finder-match")).toHaveLength(6);
    const click = async (name: string) =>
      act(async () =>
        Array.from(host.querySelectorAll("button"))
          .find((b) => b.textContent === name)!
          .click(),
      );
    await click("Next");
    expect(host.querySelectorAll(".finder-match")).toHaveLength(2);
    expect(host.textContent).toContain("Page 2 of 2");
    await click("Previous");
    expect(host.querySelectorAll(".finder-match")).toHaveLength(6);
  });
  it("does not search while the catalog is loading or stale", async () => {
    for (const props of [
      { ready: false, stale: false },
      { ready: true, stale: true },
    ]) {
      await act(async () =>
        root.render(
          <MemoryRouter>
            <FurnitureFinder products={[product]} {...props} retry={() => {}} />
          </MemoryRouter>,
        ),
      );
      expect(
        host.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled,
      ).toBe(true);
      await submit();
      expect(host.querySelectorAll(".finder-match")).toHaveLength(0);
    }
  });
  it("uses catalog filters without a model call when description is empty", async () => {
    await render();
    await submit();
    expect(mocks.interpret).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Test Grey Sofa");
  });
  it("shows the interpretation and enforces its budget", async () => {
    mocks.interpret.mockResolvedValue({
      ...blankIntent(),
      type: "Sofa",
      budget: 1000,
    });
    await render();
    await text("Sofa under 1000");
    await submit();
    expect(host.textContent).toContain("Up to ₱1,000");
    expect(host.textContent).not.toContain("Test Grey Sofa");
  });
  it("ignores a late response after the customer edits the request", async () => {
    let resolve!: (value: unknown) => void;
    mocks.interpret.mockImplementation(() => new Promise((r) => (resolve = r)));
    await render();
    await text("grey sofa");
    await submit();
    const signal = mocks.interpret.mock.calls[0][1] as AbortSignal;
    await text("blue bed");
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ ...blankIntent(), type: "Sofa" }));
    expect(host.textContent).not.toContain("Test Grey Sofa");
    expect(host.querySelector("textarea")?.value).toBe("blue bed");
  });
  it("offers filters on provider failure without pretending to match", async () => {
    mocks.interpret.mockRejectedValue(new Error("Provider busy. Use filters."));
    await render();
    await text("grey sofa");
    await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Use filters",
    );
    expect(host.textContent).not.toContain("Test Grey Sofa");
  });
  it("reset aborts an in-flight search", async () => {
    mocks.interpret.mockImplementation(() => new Promise(() => {}));
    await render();
    await text("grey sofa");
    await submit();
    const signal = mocks.interpret.mock.calls[0][1] as AbortSignal;
    await act(async () =>
      Array.from(host.querySelectorAll("button"))
        .find((b) => b.textContent === "Reset preferences")!
        .click(),
    );
    expect(signal.aborted).toBe(true);
    expect(host.querySelector("textarea")?.value).toBe("");
  });
});
