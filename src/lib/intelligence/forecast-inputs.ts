import { nextDate, type DailyObservation } from "./forecast";

export type ForecastInputs = {
  version: number; generatedAt: string; through: string; timezone: string; basis: string;
  series: DailyObservation[]; excludedTestPayments: number; undatedSettlements: number; eligibleOrders: number;
  historyStart?: string | null; lastSettlementAt?: string | null;
  sourceCounts?: { recordedOrders: number; unpaidOrders: number; cancelledOrders: number; refundedOrders: number; invalidAmounts: number };
};

/** Reject incomplete RPC responses instead of manufacturing zero days. */
export function parseForecastInputs(input: unknown): ForecastInputs {
  const data = input as ForecastInputs | null;
  const dateIsValid = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  if (!data || ![1, 2].includes(data.version) || !dateIsValid(data.through) || !Number.isFinite(Date.parse(data.generatedAt))
    || data.timezone !== "Asia/Manila" || typeof data.basis !== "string" || !Array.isArray(data.series) || data.series.length > 180
    || ![data.eligibleOrders, data.excludedTestPayments, data.undatedSettlements].every(count)
    || data.series.some((row, i) => !row || !dateIsValid(row.date) || !count(row.orders) || !Number.isFinite(row.sales) || row.sales < 0
      || row.date > data.through || (i > 0 && nextDate(data.series[i - 1].date, 1) !== row.date))
    || (data.series.length > 0 && data.series.at(-1)!.date !== data.through)
    || data.series.reduce((sum, row) => sum + row.orders, 0) !== data.eligibleOrders
    || (data.sourceCounts && !Object.values(data.sourceCounts).every(count))) {
    throw new Error("The settlement summary is incomplete. Refresh data or review the source records.");
  }
  return data;
}
