import { describe, expect, it } from "vitest";
import { selectNewArrivals } from "./new-arrivals";

const products = [
  { name: "Living 1", category: "Living room" },
  { name: "Living 2", category: "Living room" },
  { name: "Living 3", category: "Living room" },
  { name: "Bedroom 1", category: "Bedroom" },
  { name: "Dining 1", category: "Dining room" },
];

describe("selectNewArrivals", () => {
  it("shows the newest products across every room", () => {
    expect(selectNewArrivals(products, "All", 4).map((item) => item.name)).toEqual([
      "Living 1",
      "Living 2",
      "Living 3",
      "Bedroom 1",
    ]);
  });

  it("filters before applying the display limit", () => {
    expect(
      selectNewArrivals(products, "Dining room", 2).map((item) => item.name),
    ).toEqual(["Dining 1"]);
  });
});
