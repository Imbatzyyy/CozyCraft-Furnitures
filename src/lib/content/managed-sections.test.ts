import { describe, expect, it } from "vitest";
import {
  managedSectionTitle,
  parseManagedSections,
} from "@/lib/content/managed-sections";

describe("managed content sections", () => {
  it("parses admin-managed heading and copy pairs", () => {
    expect(
      parseManagedSections(
        "BUSINESS EMAIL\n\nhello@example.com\n\nSERVICE AREA\n\nPhilippines nationwide.",
      ),
    ).toEqual([
      { title: "BUSINESS EMAIL", body: "hello@example.com" },
      { title: "SERVICE AREA", body: "Philippines nationwide." },
    ]);
  });

  it("preserves multiple paragraphs within a section", () => {
    expect(
      parseManagedSections(
        "CUSTOMER CARE HOURS\n\nMonday to Saturday.\n\nMessages may be sent anytime.",
      ),
    ).toEqual([
      {
        title: "CUSTOMER CARE HOURS",
        body: "Monday to Saturday.\n\nMessages may be sent anytime.",
      },
    ]);
  });

  it("handles empty content and formats headings for display", () => {
    expect(parseManagedSections("  ")).toEqual([]);
    expect(managedSectionTitle("HOW DO REVIEWS WORK?")).toBe(
      "How do reviews work?",
    );
  });
});
