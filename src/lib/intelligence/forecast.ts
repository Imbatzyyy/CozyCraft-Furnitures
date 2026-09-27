/** Small, deterministic ML pipeline. No customer records or external AI API needed.
 * Ridge coefficients are fitted from lagged observations; candidates are selected
 * on chronological validation and evaluated on a separate final holdout.
 */
export const FORECAST_VERSION = "adaptive-settlements-v2";
export type DailyObservation = { date: string; sales: number; orders: number };
export type ForecastPoint = { date: string; value: number; lower: number; upper: number };
export type ForecastResult = {
  version: string; status: "ready" | "insufficient" | "unreliable"; reason: string;
  model: string; points: ForecastPoint[]; historyDays: number; activeDays: number;
  holdoutMae: number | null; baselineMae: number | null; validationMae: number | null;
  validationFolds: number; trainingDays: number; total: number;
  quality: "limited" | "validated" | "unavailable";
  recentActiveDays: number; lastActiveDate: string | null;
  holdoutRmse: number | null; baselineRmse: number | null;
  candidates: { model: string; rmse: number; mae: number }[];
  warnings: string[];
};
type Model = "Recent average" | "Historical average" | "Weekly baseline" | "Ridge regression (1)" | "Ridge regression (10)" | "Intermittent TSB (0.1)" | "Intermittent TSB (0.3)";
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
const rmse = (errors: number[]) => Math.sqrt(mean(errors.map(v => v * v)));
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
  if (!values.length || dates.length !== values.length) return Array(horizon).fill(0);
  if (model.startsWith("Intermittent TSB")) {
    // Teunter–Syntetos–Babai: occurrence probability updates every day;
    // positive settlement size updates only on active days. No future zeros
    // are assumed when forecasting. Validation chooses the smoothing rate.
    const alpha = model === "Intermittent TSB (0.1)" ? .1 : .3;
    const first = values.findIndex(v => v > 0);
    if (first < 0) return Array(horizon).fill(0);
    let probability = 1 / (first + 1), size = values[first];
    for (let i = first + 1; i < values.length; i++) {
      probability += alpha * ((values[i] > 0 ? 1 : 0) - probability);
      if (values[i] > 0) size += alpha * (values[i] - size);
    }
    return Array(horizon).fill(Math.max(0, probability * size));
  }
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
      : model === "Weekly baseline" ? extended[extended.length - 7]
      : model === "Historical average" ? mean(values) : mean(values.slice(-28));
    extended.push(clamp(value, cap));
  }
  return extended.slice(values.length);
}

export function buildForecast(rows: DailyObservation[], metric: "sales" | "orders", horizon: 7 | 14): ForecastResult {
  const base: ForecastResult = { version: FORECAST_VERSION, status: "insufficient", reason: "", model: "Not trained yet", points: [], historyDays: rows.length, activeDays: 0, holdoutMae: null, baselineMae: null, validationMae: null, validationFolds: 0, trainingDays: 0, total: 0, quality: "unavailable", recentActiveDays: 0, lastActiveDate: null, holdoutRmse: null, baselineRmse: null, candidates: [], warnings: [] };
  if (![7, 14].includes(horizon) || rows.length > 366 || rows.some((row, i) => !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date || !Number.isFinite(row[metric]) || row[metric] < 0 || (i > 0 && nextDate(rows[i - 1].date, 1) !== row.date))) {
    return { ...base, reason: "History is incomplete or invalid. Refresh the data before forecasting." };
  }
  const values = rows.map(row => row[metric]);
  const dates = rows.map(row => row.date);
  base.activeDays = values.filter(v => v > 0).length;
  base.recentActiveDays = values.slice(-28).filter(v => v > 0).length;
  base.lastActiveDate = rows.filter(row => row[metric] > 0).at(-1)?.date ?? null;
  const minimumDays = horizon === 7 ? 28 : 42;
  const minimumActiveDays = horizon === 7 ? 3 : 4;
  if (rows.length < minimumDays || base.activeDays < minimumActiveDays) {
    return { ...base, reason: `An initial ${horizon}-day estimate needs at least ${minimumDays} complete days and ${minimumActiveDays} active settlement days. Current history: ${rows.length} complete days and ${base.activeDays} active days. No synthetic sales are used.` };
  }
  // Reserve the last horizon entirely for evaluation, never model selection.
  const selectionEnd = values.length - horizon;
  const selectionValues = values.slice(0, selectionEnd);
  const denseHistory = selectionValues.length >= (horizon === 7 ? 42 : 56)
    && selectionValues.filter(v => v > 0).length >= 14
    && selectionValues.slice(-28).filter(v => v > 0).length >= 4;
  const models: Model[] = ["Recent average", "Historical average", "Intermittent TSB (0.1)", "Intermittent TSB (0.3)"];
  if (denseHistory) models.push("Weekly baseline", "Ridge regression (1)", "Ridge regression (10)");
  const origins = Array.from({ length: 4 }, (_, i) => selectionEnd - horizon - (3 - i) * 7)
    .filter(i => i >= 14 && values.slice(0, i).filter(v => v > 0).length >= 2);
  if (!origins.length) return { ...base, reason: "More earlier settlement activity is needed to validate a model without using future data. Recorded history is shown below." };
  const evaluations = models.map(model => {
    const residuals: number[] = [];
    for (const origin of origins) {
      const predicted = predictSeries(values.slice(0, origin), dates.slice(0, origin), horizon, model);
      predicted.forEach((value, h) => residuals.push(Math.abs(value - values[origin + h])));
    }
    return { model, mae: mean(residuals), rmse: rmse(residuals), residuals };
  // Squared error targets the expected amount, unlike MAE which can favor an
  // all-zero median forecast on intermittent sales. Deterministic ties keep
  // the simpler baseline; the holdout never chooses a different winner.
  }).sort((a, b) => a.rmse - b.rmse);
  const selected = evaluations[0];
  const test = predictSeries(values.slice(0, selectionEnd), dates.slice(0, selectionEnd), horizon, selected.model);
  const actual = values.slice(selectionEnd);
  const holdoutMae = mean(test.map((v, i) => Math.abs(v - actual[i])));
  const baseline = predictSeries(values.slice(0, selectionEnd), dates.slice(0, selectionEnd), horizon, "Recent average");
  const baselineMae = mean(baseline.map((v, i) => Math.abs(v - actual[i])));
  const holdoutRmse = rmse(test.map((v, i) => v - actual[i]));
  const baselineRmse = rmse(baseline.map((v, i) => v - actual[i]));
  const limited = !denseHistory || origins.length < 3 || actual.filter(v => v > 0).length < 2 || base.recentActiveDays < 4;
  const warnings: string[] = [];
  if (limited) warnings.push("Limited evidence: infrequent settlements or a quiet holdout cannot establish reliable forecast accuracy. Use this preliminary estimate for monitoring, not purchasing commitments.");
  if (base.recentActiveDays < 4) warnings.push(`Only ${base.recentActiveDays} active settlement day(s) in the last 28 days. Quiet periods lower the estimate; they do not prove future sales will be zero.`);
  if (holdoutRmse > baselineRmse * 1.1 && holdoutRmse > 0) warnings.push("The selected model was worse than the recent-average baseline on the independent holdout. Review the error comparison before acting.");
  const metadata = { ...base, model: selected.model, validationMae: selected.mae, holdoutMae, baselineMae, holdoutRmse, baselineRmse, validationFolds: origins.length, trainingDays: values.length, quality: limited ? "limited" as const : "validated" as const, warnings, candidates: evaluations.map(({ model, rmse, mae }) => ({ model, rmse, mae })) };
  if (denseHistory && holdoutMae > Math.max(1, mean(actual)) * 1.5) return { ...metadata, quality: "unavailable", status: "unreliable", reason: "Recent holdout error is too large for a useful forecast. Review unusual sales, missing data or a longer history; predictions are withheld." };
  const predicted = predictSeries(values, dates, horizon, selected.model);
  // Empirical historical error envelope, deliberately NOT labelled 80/95% CI.
  const residuals = [...selected.residuals, ...test.map((v, i) => Math.abs(v - actual[i]))].sort((a, b) => a - b);
  const error = Math.max(residuals[Math.min(residuals.length - 1, Math.ceil(residuals.length * .9) - 1)] || 0, rmse(residuals));
  const points = predicted.map((value, h) => ({ date: nextDate(dates[dates.length - 1], h + 1), value, lower: Math.max(0, value - error), upper: value + error }));
  return { ...metadata, status: "ready", reason: `${limited ? "Preliminary estimate from actual settlement history. " : "Validated forecast from actual settlement history. "}Models compete on chronological validation RMSE; the final holdout is separate. The shaded range is an empirical error guide, not a probability or guarantee.`, points, total: predicted.reduce((sum, value) => sum + value, 0) };
}
