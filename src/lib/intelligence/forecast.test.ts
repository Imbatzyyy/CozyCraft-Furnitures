import { describe, expect, it } from "vitest";
import { buildForecast, demoHistory, nextDate, predictSeries } from "./forecast";

describe("chronological forecasting pipeline", () => {
  it("does not fabricate a forecast for an empty or short dataset", () => {
    expect(buildForecast([], "sales", 7).points).toEqual([]);
    expect(buildForecast(demoHistory().slice(0, 30), "sales", 7).status).toBe("insufficient");
  });
  it("does not count 180 zero-filled days as sufficient activity", () => {
    const rows = demoHistory().map(r => ({ ...r, sales: 0, orders: 0 }));
    expect(buildForecast(rows, "sales", 7).status).toBe("insufficient");
  });
  it("rejects sparse recent activity", () => {
    const rows = demoHistory().map((r, i) => ({ ...r, sales: i > 80 ? 0 : r.sales }));
    expect(buildForecast(rows, "sales", 7).status).toBe("insufficient");
  });
  it("rejects missing days instead of interpreting them as zero sales", () => {
    const rows = demoHistory(); rows.splice(20, 1);
    expect(buildForecast(rows, "sales", 7).reason).toContain("incomplete");
  });
  it.each([NaN, Infinity, -1])("rejects invalid observations %s", value => {
    const rows = demoHistory(); rows[30].sales = value;
    expect(buildForecast(rows, "sales", 7).points).toEqual([]);
  });
  it("rejects invalid and out-of-order dates", () => {
    const rows = demoHistory(); rows[3].date = "2026-02-31";
    expect(buildForecast(rows, "sales", 7).status).toBe("insufficient");
  });
  it("provides bounded finite forecasts and independent holdout metrics", () => {
    const result = buildForecast(demoHistory(), "sales", 14);
    expect(result.status).toBe("ready"); expect(result.points).toHaveLength(14);
    expect(result.validationFolds).toBe(4); expect(result.holdoutMae).not.toBeNull();
    expect(result.points.every(p => Number.isFinite(p.value) && p.lower >= 0 && p.lower <= p.value && p.upper >= p.value)).toBe(true);
    expect(result.points[0].date).toBe(nextDate(demoHistory().at(-1)!.date, 1));
  });
  it("learns a stable weekly pattern better than the recent average", () => {
    const result = buildForecast(demoHistory(), "orders", 7);
    expect(result.status).toBe("ready");
    expect(result.holdoutMae!).toBeLessThan(result.baselineMae!);
  });
  it("does not select a different model after seeing the final holdout", () => {
    const rows = demoHistory(); const before = buildForecast(rows, "sales", 7);
    rows.slice(-7).forEach(r => { r.sales *= 1.1; });
    const after = buildForecast(rows, "sales", 7);
    expect(after.model).toBe(before.model); expect(after.validationMae).toBe(before.validationMae);
    expect(after.holdoutMae).not.toBe(before.holdoutMae);
  });
  it("handles a constant sequence without singular matrices or NaN", () => {
    const rows = demoHistory().map(r => ({ ...r, sales: 100, orders: 1 }));
    const result = buildForecast(rows, "sales", 7);
    expect(result.status).toBe("ready"); expect(result.total).toBeCloseTo(700);
    expect(result.model).toBe("Recent average");
  });
  it("requires more history for a longer horizon", () => {
    const rows = demoHistory().slice(0, 65);
    expect(buildForecast(rows, "orders", 7).status).toBe("ready");
    expect(buildForecast(rows, "orders", 14).status).toBe("insufficient");
  });
  it("withholds a forecast when a sudden collapse makes evaluation unreliable", () => {
    const rows = demoHistory(); rows.slice(-7).forEach(r => { r.sales = 0; });
    const result = buildForecast(rows, "sales", 7);
    expect(result.status).toBe("unreliable"); expect(result.points).toEqual([]);
  });
  it("rolls over calendar months using UTC dates", () => {
    expect(nextDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(nextDate("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("fits ridge on training data without mutating source records", () => {
    const rows = demoHistory(); const copy = JSON.stringify(rows);
    predictSeries(rows.map(r => r.sales), rows.map(r => r.date), 14, "Ridge regression (10)");
    expect(JSON.stringify(rows)).toBe(copy);
  });
});
