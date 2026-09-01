import { describe, expect, it } from "vitest";
import {
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
} from "./newsletter.service";

describe("newsletter email validation", () => {
  it("normalizes a valid customer email", () => {
    expect(normalizeNewsletterEmail("  Shopper@Example.COM ")).toBe(
      "shopper@example.com",
    );
    expect(isValidNewsletterEmail("  Shopper@Example.COM ")).toBe(true);
  });

  it.each([
    "",
    "missing-at.example.com",
    "missing-domain@",
    "two..dots@example.com",
    "name@localhost",
  ])("rejects invalid address %s", (email) => {
    expect(isValidNewsletterEmail(email)).toBe(false);
  });
});
