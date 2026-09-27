import { describe, expect, it } from "vitest";
import { ageLabel, dayLabel, formatDate, formatDateTime, humanize, plural, relativeTime } from "./format";

const now = new Date("2026-09-27T04:00:00Z"); // 12:00 PM in Manila

describe("admin formats", () => {
  it("uses one Philippine date style", () => {
    expect(formatDate("2026-09-27T00:05:00Z")).toBe("Sep 27, 2026");
    expect(formatDateTime("2026-09-27T00:05:00Z")).toBe("Sep 27, 2026 · 8:05 AM");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not a date", "Unknown")).toBe("Unknown");
  });

  it("describes recency and queue age", () => {
    expect(relativeTime("2026-09-27T03:59:40Z", now)).toBe("Just now");
    expect(relativeTime("2026-09-27T03:15:00Z", now)).toBe("45m ago");
    expect(relativeTime("2026-09-26T22:00:00Z", now)).toBe("6h ago");
    expect(relativeTime("2026-09-26T02:00:00Z", now)).toBe("Yesterday");
    expect(relativeTime("2026-09-10T02:00:00Z", now)).toBe("Sep 10, 2026");
    expect(ageLabel("2026-09-26T02:00:00Z", now)).toBe("26h");
    expect(ageLabel("2026-09-20T02:00:00Z", now)).toBe("7d");
  });

  it("labels calendar days in Manila time", () => {
    expect(dayLabel("2026-09-27T01:00:00Z", now)).toBe("Today");
    expect(dayLabel("2026-09-26T01:00:00Z", now)).toBe("Yesterday");
    expect(dayLabel("2026-09-25T01:00:00Z", now)).toBe("Friday, Sep 25");
  });

  it("pluralises and humanises labels", () => {
    expect(plural(1, "order")).toBe("1 order");
    expect(plural(3, "order")).toBe("3 orders");
    expect(plural(2, "box", "boxes")).toBe("2 boxes");
    expect(humanize("refund_processing")).toBe("Refund processing");
    expect(humanize("")).toBe("");
  });
});

describe("calendar-aware recency", () => {
  it("uses Manila calendar days once an event is more than a day old", () => {
    const sundayNoon = new Date("2026-09-27T04:00:00Z");
    expect(relativeTime("2026-09-25T10:00:00Z", sundayNoon)).toBe("2d ago");
    expect(relativeTime("2026-09-26T01:00:00Z", sundayNoon)).toBe("Yesterday");
  });
});
