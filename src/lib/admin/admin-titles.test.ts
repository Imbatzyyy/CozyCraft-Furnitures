import { expect, it } from "vitest";
import { adminTitleForPath } from "./admin-titles";

it("names each admin page for browser tabs", () => {
  expect(adminTitleForPath("/admin")).toBe("Dashboard · CozyCraft Admin");
  expect(adminTitleForPath("/admin/orders", "CozyCraft Furnitures")).toBe("Orders · CozyCraft Admin");
  expect(adminTitleForPath("/admin/products/new")).toBe("New product · CozyCraft Admin");
  expect(adminTitleForPath("/admin/unknown")).toBe("Store admin · CozyCraft Admin");
});
