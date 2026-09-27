import { describe, expect, it } from "vitest";
import { buildForecast, nextDate, predictSeries } from "./forecast";
import { forecastFixture as demoHistory } from "@/test/forecast-fixtures";

describe("chronological forecasting pipeline", () => {
  it("does not fabricate a forecast for an empty or short dataset", () => {
    expect(buildForecast([], "sales", 7).points).toEqual([]);
    expect(buildForecast(demoHistory().slice(0, 20), "sales", 7).status).toBe("insufficient");
  });
  it("does not count 180 zero-filled days as sufficient activity", () => {
    const rows = demoHistory().map(r => ({ ...r, sales: 0, orders: 0 }));
    expect(buildForecast(rows, "sales", 7).status).toBe("insufficient");
  });
  it("rejects sparse recent activity", () => {
    const rows = demoHistory().map((r, i) => ({ ...r, sales: i > 80 ? 0 : r.sales }));
    expect(buildForecast(rows, "sales", 7).status).toBe("unreliable");
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
    const rows = demoHistory().slice(0, 35);
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
  it("produces preliminary forecasts for genuinely sparse, quiet history", () => {
    const rows = Array.from({ length: 59 }, (_, i) => ({ date: nextDate("2026-07-30", i), orders: [0, 3, 6, 10, 21, 26, 33].includes(i) ? 1 : 0, sales: [0, 3, 6, 10, 21, 26, 33].includes(i) ? 10000 : 0 }));
    for (const horizon of [7, 14] as const) {
      const result = buildForecast(rows, "sales", horizon);
      expect(result.status).toBe("ready"); expect(result.quality).toBe("limited");
      expect(result.points).toHaveLength(horizon); expect(result.warnings.join(" ")).toContain("Limited evidence");
      expect(result.candidates.some(c => c.model.startsWith("Ridge"))).toBe(false);
      expect(result.points.every(p => p.upper > p.lower)).toBe(true);
    }
  });
  it("TSB decays after observed quiet days but never assumes future days are zero", () => {
    const values = [1,0,0,1,0,0,1];
    const dates = values.map((_, i) => nextDate("2026-01-01", i));
    const before = predictSeries(values, dates, 7, "Intermittent TSB (0.1)");
    const extended = [...values, ...Array(20).fill(0)];
    const after = predictSeries(extended, extended.map((_, i) => nextDate("2026-01-01", i)), 7, "Intermittent TSB (0.1)");
    expect(after[0]).toBeLessThan(before[0]); expect(new Set(after).size).toBe(1);
  });
  it("holds out the future even for intermittent model and candidate selection", () => {
    const rows = demoHistory().map((row, i) => ({ ...row, orders: i % 13 === 0 ? 1 : 0 }));
    const before = buildForecast(rows, "orders", 7);
    rows.slice(-7).forEach(row => { row.orders = 8; });
    const after = buildForecast(rows, "orders", 7);
    expect(after.model).toBe(before.model); expect(after.candidates).toEqual(before.candidates);
    expect(after.holdoutRmse).not.toBe(before.holdoutRmse);
  });
  it("is deterministic and selects the lowest validation RMSE", () => {
    const first = buildForecast(demoHistory(), "sales", 7);
    expect(first).toEqual(buildForecast(demoHistory(), "sales", 7));
    expect(first.model).toBe(first.candidates[0].model);
    expect(first.candidates[0].rmse).toBe(Math.min(...first.candidates.map(c=>c.rmse)));
  });
});
