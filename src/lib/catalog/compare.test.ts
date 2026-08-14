import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_COMPARE_PRODUCTS,
  readComparedProductIds,
  toggleComparedProduct,
  writeComparedProductIds,
} from "./compare";

describe("product comparison storage", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  beforeEach(() => values.clear());

  it("deduplicates and limits compared products", () => {
    const ids = writeComparedProductIds(["a", "a", "b", "c", "d", "e"], storage);
    expect(ids).toEqual(["a", "b", "c", "d"]);
    expect(readComparedProductIds(storage)).toHaveLength(MAX_COMPARE_PRODUCTS);
  });

  it("toggles products and reports a full comparison", () => {
    writeComparedProductIds(["a", "b", "c", "d"], storage);
    expect(toggleComparedProduct("e", storage).limitReached).toBe(true);
    expect(toggleComparedProduct("a", storage)).toMatchObject({ added: false, limitReached: false });
    expect(readComparedProductIds(storage)).toEqual(["b", "c", "d"]);
  });
});
