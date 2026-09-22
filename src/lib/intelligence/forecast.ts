/** Small, deterministic ML pipeline. No customer records or external AI API needed.
 * Ridge coefficients are fitted from lagged observations; candidates are selected
 * on chronological validation and evaluated on a separate final holdout.
 */
export const FORECAST_VERSION = "ridge-demand-v1";
export type DailyObservation = { date: string; sales: number; orders: number };
export type ForecastPoint = { date: string; value: number; lower: number; upper: number };
export type ForecastResult = {
  version: string; status: "ready" | "insufficient" | "unreliable"; reason: string;
  model: string; points: ForecastPoint[]; historyDays: number; activeDays: number;
  holdoutMae: number | null; baselineMae: number | null; validationMae: number | null;
  validationFolds: number; trainingDays: number; total: number;
};
type Model = "Recent average" | "Weekly baseline" | "Ridge regression (1)" | "Ridge regression (10)";
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
const clamp = (value: number, cap: number) => Number.isFinite(value) ? Math.min(cap, Math.max(0, value)) : 0;
const day = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
export const nextDate = (date: string, offset: number) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);

function features(values: number[], index: number, weekday: number, scale: number) {
  return [1, values[index - 1] / scale, values[index - 7] / scale,
    mean(values.slice(index - 7, index)) / scale, mean(values.slice(index - 14, index)) / scale,
    Math.sin(weekday * 2 * Math.PI / 7), Math.cos(weekday * 2 * Math.PI / 7)];
}

/** Pivoted linear solve; L2 penalty stabilizes correlated lag features. */
function solve(matrix: number[][], target: number[]) {
  const a = matrix.map((row, i) => [...row, target[i]]);
  for (let i = 0; i < a.length; i++) {
    let pivot = i;
    for (let j = i + 1; j < a.length; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    const divisor = a[i][i];
    if (Math.abs(divisor) < 1e-10) return null;
    for (let k = i; k <= a.length; k++) a[i][k] /= divisor;
    for (let j = 0; j < a.length; j++) {
      if (j === i) continue;
      const factor = a[j][i];
      for (let k = i; k <= a.length; k++) a[j][k] -= factor * a[i][k];
    }
  }
  return a.map(row => row[a.length]);
}

export function predictSeries(values: number[], dates: string[], horizon: number, model: Model): number[] {
  const scale = Math.max(1, mean(values));
  // A safety ceiling, not a promised upper bound. Includes only training data.
  const cap = Math.max(scale * 5, ...values) * 2;
  let weights: number[] | null = null;
  if (model.startsWith("Ridge")) {
    const matrix = Array.from({ length: 7 }, () => Array(7).fill(0) as number[]);
    const target = Array(7).fill(0) as number[];
    for (let i = 14; i < values.length; i++) {
      const x = features(values, i, day(dates[i]), scale);
      for (let r = 0; r < 7; r++) {
        target[r] += x[r] * values[i] / scale;
        for (let c = 0; c < 7; c++) matrix[r][c] += x[r] * x[c];
      }
    }
    for (let i = 1; i < 7; i++) matrix[i][i] += model === "Ridge regression (1)" ? 1 : 10;
    weights = solve(matrix, target);
  }
  const extended = [...values];
  for (let h = 1; h <= horizon; h++) {
    const date = nextDate(dates[dates.length - 1], h);
    const x = features(extended, extended.length, day(date), scale);
    const value = weights ? weights.reduce((s, w, i) => s + w * x[i], 0) * scale
      : model === "Weekly baseline" ? extended[extended.length - 7] : mean(values.slice(-28));
    extended.push(clamp(value, cap));
  }
  return extended.slice(values.length);
}

export function buildForecast(rows: DailyObservation[], metric: "sales" | "orders", horizon: 7 | 14): ForecastResult {
  const base: ForecastResult = { version: FORECAST_VERSION, status: "insufficient", reason: "", model: "Not trained yet", points: [], historyDays: rows.length, activeDays: 0, holdoutMae: null, baselineMae: null, validationMae: null, validationFolds: 0, trainingDays: 0, total: 0 };
  if (![7, 14].includes(horizon) || rows.length > 366 || rows.some((row, i) => !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date || !Number.isFinite(row[metric]) || row[metric] < 0 || (i > 0 && nextDate(rows[i - 1].date, 1) !== row.date))) {
    return { ...base, reason: "History is incomplete or invalid. Refresh the data before forecasting." };
  }
  const values = rows.map(row => row[metric]);
  const dates = rows.map(row => row.date);
  base.activeDays = values.filter(v => v > 0).length;
  const minimumDays = horizon === 7 ? 56 : 84;
  if (rows.length < minimumDays || base.activeDays < 14 || values.slice(-28).filter(v => v > 0).length < 4) {
    return { ...base, reason: `This view needs at least ${minimumDays} complete days, 14 days with eligible sales, and activity on 4 of the last 28 days. More genuine history is needed; no prediction has been invented.` };
  }
  const models: Model[] = ["Recent average", "Weekly baseline", "Ridge regression (1)", "Ridge regression (10)"];
  // Reserve the last horizon entirely for evaluation, never model selection.
  const selectionEnd = values.length - horizon;
  const origins = Array.from({ length: 4 }, (_, i) => selectionEnd - horizon - (3 - i) * 7).filter(i => i >= 28);
  const evaluations = models.map(model => {
    const residuals: number[] = [];
    for (const origin of origins) {
      const predicted = predictSeries(values.slice(0, origin), dates.slice(0, origin), horizon, model);
      predicted.forEach((value, h) => residuals.push(Math.abs(value - values[origin + h])));
    }
    return { model, mae: mean(residuals), residuals };
  }).sort((a, b) => a.mae - b.mae);
  const selected = evaluations[0];
  const test = predictSeries(values.slice(0, selectionEnd), dates.slice(0, selectionEnd), horizon, selected.model);
  const actual = values.slice(selectionEnd);
  const holdoutMae = mean(test.map((v, i) => Math.abs(v - actual[i])));
  const baseline = predictSeries(values.slice(0, selectionEnd), dates.slice(0, selectionEnd), horizon, "Recent average");
  const baselineMae = mean(baseline.map((v, i) => Math.abs(v - actual[i])));
  const metadata = { ...base, model: selected.model, validationMae: selected.mae, holdoutMae, baselineMae, validationFolds: origins.length, trainingDays: values.length };
  if (holdoutMae > Math.max(1, mean(actual)) * 1.5) return { ...metadata, status: "unreliable", reason: "Recent holdout error is too large for a useful forecast. Review unusual sales, missing data or a longer history; predictions are withheld." };
  const predicted = predictSeries(values, dates, horizon, selected.model);
  // Empirical historical error envelope, deliberately NOT labelled 80/95% CI.
  const residuals = [...selected.residuals, ...test.map((v, i) => Math.abs(v - actual[i]))].sort((a, b) => a - b);
  const error = residuals[Math.min(residuals.length - 1, Math.ceil(residuals.length * .9) - 1)] || 0;
  const points = predicted.map((value, h) => ({ date: nextDate(dates[dates.length - 1], h + 1), value, lower: Math.max(0, value - error), upper: value + error }));
  return { ...metadata, status: "ready", reason: "Validated on chronological windows; final holdout is separate from model selection. The shaded range is a historical-error guide, not a guaranteed probability interval.", points, total: predicted.reduce((sum, value) => sum + value, 0) };
}

/** Explicitly synthetic. Never submitted to the database or mixed into sales. */
export function demoHistory(): DailyObservation[] {
  return Array.from({ length: 112 }, (_, i) => {
    const date = nextDate("2026-01-01", i);
    const orders = 3 + (i % 7 > 4 ? 3 : 0) + Math.floor(i / 28) + (i % 11 === 0 ? 1 : 0);
    return { date, orders, sales: orders * (4800 + (i % 5) * 120) };
  });
}
