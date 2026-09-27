// Test/localhost-only input. Never imported by the production forecasting UI.
import { nextDate, type DailyObservation } from "@/lib/intelligence/forecast";
export function forecastFixture(): DailyObservation[] {
  return Array.from({ length: 112 }, (_, i) => {
    const date = nextDate("2026-01-01", i);
    const orders = 3 + (i % 7 > 4 ? 3 : 0) + Math.floor(i / 28) + (i % 11 === 0 ? 1 : 0);
    return { date, orders, sales: orders * (4800 + (i % 5) * 120) };
  });
}
