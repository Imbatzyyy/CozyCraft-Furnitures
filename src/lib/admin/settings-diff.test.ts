import { expect, it } from "vitest";
import { describeSettingValue, diffSettings } from "./settings-diff";

it("lists readable field-level changes and ignores bookkeeping fields", () => {
  const before = { id: true, updated_at: "a", store_name: "Cozy", checkout_settings: { cod_enabled: true, standard_delivery_fee: 650 } };
  const after = { id: true, updated_at: "b", store_name: "CozyCraft", checkout_settings: { cod_enabled: false, standard_delivery_fee: 650 } };
  expect(diffSettings(before, after)).toEqual([
    { path: "store_name", label: "Store name", before: "Cozy", after: "CozyCraft" },
    { path: "checkout_settings.cod_enabled", label: "Cash on delivery", before: true, after: false },
  ]);
  expect(diffSettings(before, before)).toEqual([]);
});

it("describes values for people", () => {
  expect(describeSettingValue(true)).toBe("On");
  expect(describeSettingValue("")).toBe("Empty");
  expect(describeSettingValue(["a", "b"])).toBe("a, b");
  expect(describeSettingValue(15)).toBe("15");
});
