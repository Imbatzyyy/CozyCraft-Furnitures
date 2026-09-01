import { describe, expect, it } from "vitest";
import { blankNewsletterDraft, validateNewsletterDraft } from "./newsletter-admin.service";

describe("newsletter campaign validation", () => {
  it("accepts a complete campaign", () => {
    expect(validateNewsletterDraft({
      ...blankNewsletterDraft(),
      internal_name: "August arrivals",
      subject: "A considered August edit",
      heading: "New pieces, quietly introduced.",
      body: "Explore the latest CozyCraft pieces.",
    })).toBeNull();
  });

  it("rejects unsafe actions and too many products", () => {
    const draft = { ...blankNewsletterDraft(), internal_name: "Test", subject: "Test", heading: "Test", body: "Test" };
    expect(validateNewsletterDraft({ ...draft, cta_path: "https://example.com" })).toMatch(/safe/);
    expect(validateNewsletterDraft({ ...draft, product_ids: ["1", "2", "3", "4", "5"] })).toMatch(/four/);
  });
});
