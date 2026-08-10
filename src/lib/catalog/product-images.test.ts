import { describe, expect, it } from "vitest";
import {
  canonicalProductImages,
  primaryProductImage,
  productMainImageIndex,
} from "./product-images";

describe("product image selection", () => {
  it("uses the saved main image index", () => {
    const product = { images: ["one.jpg", "two.jpg", "three.jpg"], mainImageIndex: 2 };
    expect(productMainImageIndex(product)).toBe(2);
    expect(primaryProductImage(product)).toBe("three.jpg");
  });

  it("safely falls back when an index is invalid", () => {
    expect(primaryProductImage({ images: ["one.jpg"], mainImageIndex: 8 })).toBe("one.jpg");
    expect(primaryProductImage({ images: [] })).toBe("");
  });

  it("moves the chosen photo first for web and mobile compatibility", () => {
    expect(canonicalProductImages(["one.jpg", "two.jpg", "three.jpg"], 1)).toEqual({
      images: ["two.jpg", "one.jpg", "three.jpg"],
      mainImageIndex: 0,
    });
  });
});
