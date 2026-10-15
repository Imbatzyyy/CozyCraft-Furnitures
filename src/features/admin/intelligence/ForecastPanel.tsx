import { useEffect, useMemo, useState } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownToLine, ChartNoAxesCombined, RefreshCw, ShieldCheck } from "lucide-react";
import { adminSupabase } from "@/services/supabase/client";
import { money, useAdminSession } from "@/app/core";
import { buildForecast, type DailyObservation, type ForecastResult } from "@/lib/intelligence/forecast";
import { parseForecastInputs, type ForecastInputs, type ForecastSource } from "@/lib/intelligence/forecast-inputs";
import { watchVisibleRecovery } from "@/lib/shared/visible-recovery";
import "./intelligence.css";
export type { ForecastInputs } from "@/lib/intelligence/forecast-inputs";

export function ForecastSourceControl({ source, disabled, onChange }: { source: ForecastSource; disabled: boolean; onChange: (value: ForecastSource) => void }) {
  return <div className="forecast-source-controls" role="group" aria-label="Forecast data source">
    <span>Forecast data source</span>
    <div className="forecast-tabs">{(["live", "classroom"] as const).map(value => <button key={value} type="button" disabled={disabled} aria-pressed={source === value} onClick={() => onChange(value)}>{value === "live" ? "Real store data" : "Classroom data"}</button>)}</div>
  </div>;
}

export function ForecastPanel() {
  const { workspaceReady, userId } = useAdminSession();
  const [selection, setSelection] = useState<{ owner: string; source: ForecastSource } | null>(null);
  const source = selection?.owner === userId && workspaceReady ? selection.source : "live";
  const [snapshot, setSnapshot] = useState<{ owner: string; source: ForecastSource; data: ForecastInputs } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!workspaceReady || !userId) { setSnapshot(null); setSelection(null); setError(""); setLoading(false); return; }
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true); setError("");
    void (async () => {
      try {
        const { data, error: issue } = await adminSupabase.rpc(source === "live" ? "admin_forecast_inputs" : "admin_classroom_forecast_inputs").abortSignal(controller.signal);
        if (issue) throw new Error("Forecast history could not be loaded. Check your connection and retry.");
        const parsed = parseForecastInputs(data, source);
        if (active) setSnapshot({ owner: userId, source, data: parsed });
      } catch (issue) { if (active) setError(issue instanceof Error ? issue.message : "Forecast history could not be loaded. Please retry."); }
      finally { window.clearTimeout(timer); if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [workspaceReady, userId, reload, source]);
  useEffect(() => {
    if (!workspaceReady || !userId) return;
    const recovery = watchVisibleRecovery(() => setReload(v => v + 1), 15 * 60_000);
    return () => recovery.dispose();
  }, [workspaceReady, userId]);
  return <div className="forecast-workspace">
    <ForecastSourceControl source={source} disabled={!workspaceReady || !userId} onChange={value => { setError(""); setSelection({ owner: userId!, source: value }); }} />
    <ForecastView key={`${workspaceReady ? userId : "waiting"}-${source}`} source={source} data={workspaceReady && snapshot?.owner === userId && snapshot.source === source ? snapshot.data : null} loading={loading} error={error} refresh={() => setReload(v => v + 1)} />
  </div>;
}

export function ForecastView({ data, loading, error, refresh, source }: { data: ForecastInputs | null; loading: boolean; error: string; refresh: () => void; source?: ForecastSource }) {
  const synthetic = source === "classroom" || data?.dataset?.kind === "synthetic";
  const [metric, setMetric] = useState<"sales" | "orders">("sales");
  const [horizon, setHorizon] = useState<7 | 14>(7);
  const [calculation, setCalculation] = useState<{ rows: DailyObservation[]; metric: string; horizon: number; result: ForecastResult } | null>(null);
  const [modelError, setModelError] = useState("");
  const [retry, setRetry] = useState(0);
  const rows = useMemo(() => data?.series ?? [], [data]);
  const result = calculation?.rows === rows && calculation.metric === metric && calculation.horizon === horizon ? calculation.result : null;
  useEffect(() => {
    setCalculation(null); setModelError("");
    if (!data) return;
    let active = true;
    let worker: Worker | undefined;
    let timer: number | undefined;
    const accept = (result: ForecastResult) => { if (active) setCalculation({ rows, metric, horizon, result }); };
    const fallback = () => {
      try { if (active) accept(buildForecast(rows, metric, horizon)); }
      catch { if (active) setModelError("We could not calculate this forecast. Please retry."); }
    };
    try {
      worker = new Worker(new URL("../../../lib/intelligence/forecast.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = event => {
        if (!active) return;
        window.clearTimeout(timer);
        if (event.data.result) accept(event.data.result);
        else setModelError(event.data.error || "Forecast unavailable.");
        worker?.terminate();
      };
      worker.onerror = () => { window.clearTimeout(timer); worker?.terminate(); fallback(); };
      timer = window.setTimeout(() => { worker?.terminate(); fallback(); }, 4000);
      worker.postMessage({ rows, metric, horizon });
    } catch { fallback(); }
    return () => { active = false; worker?.terminate(); window.clearTimeout(timer); };
  }, [data, rows, metric, horizon, retry]);
  const format = (value: number) => metric === "sales" ? value.toLocaleString("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value > 0 && value < .01 ? "<0.01" : Number(value.toFixed(2)).toLocaleString("en-PH");
  const snapshotTime = data ? new Date(data.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "";
  const chart = useMemo(() => {
    const history = rows.slice(-42).map(row => ({ date: row.date, actual: row[metric], prediction: undefined as number | undefined, band: undefined as [number, number] | undefined }));
    if (result?.status === "ready") {
      if (history.length) history[history.length - 1].prediction = history[history.length - 1].actual;
      return [...history, ...result.points.map(p => ({ date: p.date, actual: undefined, prediction: p.value, band: [p.lower, p.upper] as [number, number] }))];
    }
    return history;
  }, [rows, metric, result]);
  const download = () => {
    if (!data || result?.status !== "ready") return;
    const numeric = (value: number) => metric === "sales" ? value.toFixed(2) : Number(value.toPrecision(8)).toString();
    const datasetLabel = synthetic ? `SYNTHETIC CLASSROOM DATA - NOT REAL SALES (${data.dataset?.id ?? "classroom"})` : "Actual eligible settlements";
    const text = [["Dataset", "Snapshot UTC", "History through (Asia/Manila)", "Date", "Metric", "Forecast", "Error lower guide", "Error upper guide", "Model", "Evidence", "Algorithm version"], ...result.points.map(point => [datasetLabel, data.generatedAt, data.through, point.date, metric, numeric(point.value), numeric(point.lower), numeric(point.upper), result.model, synthetic ? `${result.quality} on synthetic scenario only` : result.quality, result.version])].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `cozycraft-${synthetic ? "synthetic-classroom-" : ""}forecast-${metric}-${data.through}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="forecast-panel" aria-labelledby="forecast-title" aria-busy={loading}>
    <header className="forecast-heading"><div><p className="intelligence-eyebrow"><ChartNoAxesCombined size={14} aria-hidden="true" /> COZYCRAFT INTELLIGENCE</p><h2 id="forecast-title">{synthetic ? "Explore the forecasting model." : "A clearer view of what’s next."}</h2><p>{synthetic ? "Explore trends and model validation using the classroom dataset." : "Adaptive forecasting from actual CozyCraft settlements. Evidence first, not promises."}</p></div><button type="button" className="intelligence-button" disabled={loading} onClick={refresh}><RefreshCw size={15} aria-hidden="true" />{loading ? "Updating…" : "Refresh data"}</button></header>
    {synthetic && <p className="forecast-caption" role="note">Classroom dataset · not actual sales</p>}
    <div className="forecast-controls"><div className="forecast-tabs" aria-label="Forecast metric">{(["sales", "orders"] as const).map(value => <button type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}>{value === "sales" ? (synthetic ? "Simulated sales" : "Settled sales") : (synthetic ? "Simulated orders" : "Settled orders")}</button>)}</div><label>Look ahead<select value={horizon} onChange={e => setHorizon(Number(e.target.value) as 7 | 14)}><option value={7}>7 days</option><option value={14}>14 days</option></select></label>{!synthetic && <span className="forecast-source"><ShieldCheck size={14} aria-hidden="true" />Actual store data only</span>}</div>
    {error && <p className="forecast-error" role="alert">{error} {data && "Showing the previous snapshot, not a fresh update."} <button type="button" onClick={refresh} disabled={loading}>Retry</button></p>}
    {data && <p className="forecast-caption">Complete days through {data.through} · Philippine time · {data.eligibleOrders} {synthetic ? "simulated orders" : `eligible settled orders · ${data.excludedTestPayments} test payments excluded`} · {synthetic ? "Dataset created" : "Snapshot"} {snapshotTime}</p>}
    {Boolean(data?.undatedSettlements) && <p className="forecast-notice">{data!.undatedSettlements} paid records lack a usable settlement date and are excluded. Review the payment or delivery history; dates are never guessed.</p>}
    {data && result ? <>
      <div className="forecast-summary"><div><span>{result.status === "ready" ? `${result.quality === "limited" ? "Preliminary estimate" : "Estimated total"} · next ${horizon} days` : "Forecast readiness"}</span><strong>{result.status === "ready" ? format(result.total) : result.status === "insufficient" ? "Building settlement history" : "Review data quality"}</strong></div><div><span>Complete days / active days</span><strong>{result.historyDays} / {result.activeDays}</strong></div><div><span>Selected model</span><b>{result.model}</b><span className="forecast-evidence">{result.quality === "limited" ? "Limited evidence" : result.quality === "validated" ? "Chronologically validated" : "Not enough evidence"}{synthetic && " · classroom dataset"}</span></div></div>
      <p className="forecast-caption">{synthetic ? result.reason.replaceAll("actual settlement history", "classroom history").replace("No synthetic sales are used.", "Only classroom observations are used in this scenario.") : result.reason}</p>
      {result.warnings.length > 0 && <div className="forecast-notice" role="status"><strong>Before using this estimate</strong><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
      <p className="forecast-caption">{synthetic ? "Last simulated active day" : "Last eligible settlement day"}: {result.lastActiveDate ?? "None yet"} · Active days in the last 28: {result.recentActiveDays} · {synthetic ? "Simulated" : "Recorded"} {metric === "sales" ? "sales" : "orders"} in the last 28 days: {format(rows.slice(-28).reduce((sum, row) => sum + row[metric], 0))}</p>
      {chart.length > 0 && <div className="forecast-chart" role="img" aria-label={`${synthetic ? "Simulated" : "Settled"} ${metric === "sales" ? "sales" : "order"} history${result.status === "ready" ? " and forecast with historical error guide" : ". No forecast available"}. Data tables follow.`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{ top: 20, right: 12, left: 0, bottom: 4 }}><XAxis dataKey="date" tickFormatter={v => String(v).slice(5)} minTickGap={24} tickLine={false} axisLine={{ stroke: "var(--adm-chart-grid)" }} tick={{ fontSize: 11, fill: "var(--adm-chart-axis)" }} /><YAxis width={58} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--adm-chart-axis)" }} tickFormatter={v => metric === "sales" && v >= 1000 ? `${Math.round(v / 1000)}k` : String(Number(Number(v).toFixed(1)))} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--popover-foreground)" }} labelFormatter={v => String(v)} formatter={(v: number | number[], name: string) => [Array.isArray(v) ? `${format(v[0])}–${format(v[1])}` : format(Number(v)), name === "actual" ? (synthetic ? "Simulated" : "Recorded") : name === "band" ? "Historical error guide" : "Forecast"]} /><Area dataKey="band" stroke="none" fill="var(--adm-success-ink)" fillOpacity={.18} isAnimationActive={false} /><Line type="linear" dataKey="actual" stroke="var(--adm-chart-line)" strokeWidth={2.25} dot={false} isAnimationActive={false} /><Line type="linear" dataKey="prediction" stroke="var(--adm-success-ink)" strokeDasharray="6 4" strokeWidth={2.25} dot={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div>}
      <div className="forecast-caption">Solid: {synthetic ? "classroom history" : "recorded"} · Dashed: {synthetic ? "scenario forecast" : "forecast"} · Shaded: empirical error guide. {metric === "orders" && "Fractional order estimates are statistical averages, not promised whole orders."}</div>
      {result.status === "ready" && <><div className="forecast-evaluation"><p><b>Independent holdout RMSE</b><span>{format(result.holdoutRmse ?? 0)} per day</span></p><p><b>Recent-average baseline RMSE</b><span>{format(result.baselineRmse ?? 0)} per day</span></p><p><b>Selection validation</b><span>{result.validationFolds} chronological windows · {horizon}-day horizon</span></p></div><button className="intelligence-button" type="button" onClick={download}><ArrowDownToLine size={15} aria-hidden="true" />Download forecast CSV</button><details className="forecast-details"><summary>View forecast values</summary><div className="forecast-table-scroll"><table><caption>{synthetic ? "Classroom forecast" : "Live-data forecast"} · {metric} · {result.quality === "limited" ? "Preliminary" : "Validated"}</caption><thead><tr><th>Date</th><th>Forecast</th><th>Lower guide</th><th>Upper guide</th></tr></thead><tbody>{result.points.map(p => <tr key={p.date}><th>{p.date}</th><td>{format(p.value)}</td><td>{format(p.lower)}</td><td>{format(p.upper)}</td></tr>)}</tbody></table></div></details></>}
      {result.candidates.length > 0 && <details className="forecast-details"><summary>Compare model validation</summary><p>Lower validation RMSE is better. The final holdout is not used to choose the winner. A simpler model can legitimately outperform regression.</p><div className="forecast-table-scroll"><table><caption>Model selection · {result.version}</caption><thead><tr><th>Candidate</th><th>Validation RMSE</th><th>Validation MAE</th></tr></thead><tbody>{result.candidates.map(candidate => <tr key={candidate.model}><th>{candidate.model}{candidate.model === result.model ? " · Selected" : ""}</th><td>{format(candidate.rmse)}</td><td>{format(candidate.mae)}</td></tr>)}</tbody></table></div></details>}
      <details className="forecast-details"><summary>Data coverage and exclusions</summary><p>{data.basis}</p>{data.sourceCounts && <p>Recorded orders: {data.sourceCounts.recordedOrders} · Unpaid: {data.sourceCounts.unpaidOrders} · Cancelled: {data.sourceCounts.cancelledOrders} · Refunded: {data.sourceCounts.refundedOrders} · Invalid amounts: {data.sourceCounts.invalidAmounts}. Diagnostic categories can overlap and are all-time counts; eligible totals above cover only the displayed history.</p>}{!synthetic && <p>Provider test payments are excluded. COD has no provider test flag: administrators must keep demonstration COD orders separate from genuine trading. The system cannot infer whether an unmarked COD record was a real purchase.</p>}<div className="forecast-table-scroll"><table><caption>{synthetic ? "Classroom daily observations" : "Actual daily settlements"} · complete history used by the model</caption><thead><tr><th>Date (Philippines)</th><th>{synthetic ? "Simulated orders" : "Settled orders"}</th><th>{synthetic ? "Simulated sales" : "Settled sales"}</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><th>{row.date}</th><td>{row.orders}</td><td>{money(row.sales)}</td></tr>)}</tbody></table></div></details>
      <details className="forecast-details"><summary>How this forecasting works and its limits</summary><p>Infrequent sales use recent/historical averages and Teunter–Syntetos–Babai (TSB) models, which learn settlement occurrence and size separately. With sufficient active history, weekly patterns and ridge regression also compete. Chronological validation chooses the lowest RMSE; a separate final holdout reports error. Parameters are fitted again on all complete history for the next forecast.</p><p>Initial estimates require {horizon === 7 ? "28 complete days and 3 active days" : "42 complete days and 4 active days"}, plus earlier activity for validation. Sparse history stays preliminary. A quiet holdout cannot establish high accuracy. Error guides are not calibrated confidence intervals. No algorithm can guarantee future sales.</p><p>{synthetic ? "This fixed scenario has no connection to actual customer settlements. The forecast begins after its recorded end date; it is not an estimate of current real sales or proof of real-world accuracy." : "Today’s incomplete day is excluded. Current statuses reconcile past settlements; backtesting is retrospective, not archived as-of performance. Refunds, stockouts, promotions and demand changes can affect results. This predicts retained settlements—not profit or all incoming orders."}</p><p>No external AI service receives customer data. At most 180 daily aggregates are read. Calculation runs in a background worker when supported. {synthetic ? "Classroom history is stored separately and read only when selected; it does not subscribe to live order changes." : "The protected server cache lasts up to 15 minutes and is invalidated when source records change."} Refresh data or return to this tab after 15 minutes to recheck; there is no constant polling.</p></details>
    </> : <p className="forecast-caption" role="status">{modelError || (loading ? "Loading the protected daily summary…" : error ? "Forecast unavailable until the selected data can be loaded." : data ? "Fitting and validating the forecasting models…" : "Waiting for a verified administrator session and forecast data.")}</p>}
    {modelError && <button className="intelligence-button" type="button" onClick={() => setRetry(v => v + 1)}>Retry calculation</button>}
  </section>;
}
