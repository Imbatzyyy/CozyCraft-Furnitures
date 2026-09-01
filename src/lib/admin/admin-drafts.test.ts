import { describe, expect, it } from "vitest";
import {
  clearAdminDraft,
  readAdminDraft,
  writeAdminDraft,
  type DraftStorage,
} from "./admin-drafts";

const memoryStorage = (): DraftStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

const isDraft = (value: unknown): value is { name: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { name?: unknown }).name === "string";

describe("admin draft recovery", () => {
  it("restores a valid unfinished draft", () => {
    const storage = memoryStorage();
    writeAdminDraft("product", { name: "TONSTAD" }, storage);
    expect(readAdminDraft("product", isDraft, storage)).toEqual({
      name: "TONSTAD",
    });
  });

  it("removes invalid or completed drafts", () => {
    const storage = memoryStorage();
    storage.setItem("product", JSON.stringify({ name: 42 }));
    expect(readAdminDraft("product", isDraft, storage)).toBeNull();
    expect(storage.getItem("product")).toBeNull();

    writeAdminDraft("product", { name: "EKETT" }, storage);
    clearAdminDraft("product", storage);
    expect(storage.getItem("product")).toBeNull();
  });
});
