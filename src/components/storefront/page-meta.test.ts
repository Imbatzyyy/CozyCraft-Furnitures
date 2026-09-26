import { describe, expect, it } from "vitest";
import { titleForPath } from "./page-meta";

describe("storefront page titles", () => {
  it("names each customer page and keeps the brand last", () => {
    expect(titleForPath("/home")).toBe("CozyCraft Furnitures · Furniture for a warmer home");
    expect(titleForPath("/")).toBe("CozyCraft Furnitures · Furniture for a warmer home");
    expect(titleForPath("/living-room")).toBe("Living room furniture · CozyCraft Furnitures");
    expect(titleForPath("/shop", "Cozy")).toBe("Shop all furniture · Cozy");
    expect(titleForPath("/checkout")).toBe("Secure checkout · CozyCraft Furnitures");
  });

  it("labels unknown paths as not found", () => {
    expect(titleForPath("/definitely-missing")).toBe("Page not found · CozyCraft Furnitures");
  });
});
