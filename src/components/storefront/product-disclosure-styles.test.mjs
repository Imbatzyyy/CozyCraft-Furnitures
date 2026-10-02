import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Read the shipped source instead of importing CSS, which Vitest stubs in jsdom.
it("uses native disclosure layout without intrinsic-height or visibility transitions", () => {
  const css = readFileSync(new URL("../../styles/storefront.css", import.meta.url), "utf8");
  expect(css).not.toMatch(/interpolate-size\s*:\s*allow-keywords/);
  expect(css).toMatch(/\.cc-accordion::details-content\s*\{\s*transition:\s*none;/);
});
