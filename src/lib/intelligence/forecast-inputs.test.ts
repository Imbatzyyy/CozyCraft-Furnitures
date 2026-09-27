import { describe, expect, it } from "vitest";
import { parseForecastInputs, type ForecastInputs } from "./forecast-inputs";
const valid = (): ForecastInputs => ({version:2,generatedAt:"2026-09-27T00:00:00Z",through:"2026-09-26",timezone:"Asia/Manila",basis:"Actual settlements",series:[{date:"2026-09-25",sales:100,orders:1},{date:"2026-09-26",sales:0,orders:0}],eligibleOrders:1,excludedTestPayments:74,undatedSettlements:1});
describe("forecast input contract", () => {
  it("accepts bounded real aggregates", () => expect(parseForecastInputs(valid())).toEqual(valid()));
  it("does not manufacture empty data from missing or malformed responses", () => {
    for(const input of [null,{}, { ...valid(), series:null }, { ...valid(), eligibleOrders:2 }, { ...valid(), through:"2026-09-27" }, { ...valid(), generatedAt:"invalid" }, { ...valid(), timezone:"UTC" }]) expect(()=>parseForecastInputs(input)).toThrow();
  });
  it("rejects invalid numeric values, dates, duplicate days and gaps", () => {
    for(const series of [[{date:"2026-09-26",sales:NaN,orders:1}],[{date:"2026-09-26",sales:100,orders:.5}],[{date:"2026-02-31",sales:100,orders:1}],[{date:"2026-09-24",sales:100,orders:1},{date:"2026-09-26",sales:0,orders:0}]]) expect(()=>parseForecastInputs({...valid(),series})).toThrow();
  });
});
