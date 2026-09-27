import { expect, it } from "vitest";
import { adminTitleForPath } from "./admin-titles";

it("names each admin page for browser tabs", () => {
  expect(adminTitleForPath("/admin")).toBe("Overview · CozyCraft Operations");
  expect(adminTitleForPath("/admin/orders", "CozyCraft Furnitures")).toBe("Orders · CozyCraft Operations");
  expect(adminTitleForPath("/admin/products/new")).toBe("New product · CozyCraft Operations");
  expect(adminTitleForPath("/admin/unknown")).toBe("Operations · CozyCraft Operations");
});
