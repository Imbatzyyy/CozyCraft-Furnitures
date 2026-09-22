import { useEffect, useMemo, useState } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownToLine, ChartNoAxesCombined, RefreshCw, ShieldCheck } from "lucide-react";
import { adminSupabase } from "@/services/supabase/client";
import { money, useAdminSession } from "@/app/core";
import { buildForecast, demoHistory, type DailyObservation, type ForecastResult } from "@/lib/intelligence/forecast";
import "./intelligence.css";

export type ForecastInputs = { version: number; generatedAt: string; through: string; timezone: string; basis: string; series: DailyObservation[]; excludedTestPayments: number; undatedSettlements: number; eligibleOrders: number };

export function ForecastPanel() {
  const { workspaceReady, userId } = useAdminSession();
  const [snapshot, setSnapshot] = useState<{ owner: string; data: ForecastInputs } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!workspaceReady || !userId) { setSnapshot(null); return; }
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true); setError("");
    void (async () => {
      try {
        const { data, error: issue } = await adminSupabase.rpc("admin_forecast_inputs").abortSignal(controller.signal);
        if (issue || !Array.isArray(data?.series)) throw new Error("Forecast history could not be loaded. Your reports have not been changed.");
        if (active) setSnapshot({ owner: userId, data: data as ForecastInputs });
      } catch { if (active) setError("Forecast history could not be loaded. Check your connection and retry."); }
      finally { window.clearTimeout(timer); if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [workspaceReady, userId, reload]);
  // No polling/subscriptions; this closed-day dataset is cached for 15 minutes.
  return <ForecastView data={workspaceReady && snapshot?.owner === userId ? snapshot.data : null} loading={loading} error={error} refresh={() => setReload(v => v + 1)} />;
}

export function ForecastView({ data, loading, error, refresh }: { data: ForecastInputs | null; loading: boolean; error: string; refresh: () => void }) {
  const [metric, setMetric] = useState<"sales" | "orders">("sales");
  const [horizon, setHorizon] = useState<7 | 14>(7);
  const [demo, setDemo] = useState(false);
  const [calculation, setCalculation] = useState<{ rows: DailyObservation[]; metric: string; horizon: number; result: ForecastResult } | null>(null);
  const [modelError, setModelError] = useState("");
  const [retry, setRetry] = useState(0);
  const rows = useMemo(() => demo ? demoHistory() : data?.series ?? [], [data, demo]);
  const result = calculation?.rows === rows && calculation.metric === metric && calculation.horizon === horizon ? calculation.result : null;
  useEffect(() => {
    setCalculation(null); setModelError("");
    let active = true;
    let worker: Worker | undefined;
    let timer: number | undefined;
    const accept = (result: ForecastResult) => { if (active) setCalculation({ rows, metric, horizon, result }); };
    const fallback = () => {
      try { if (active) accept(buildForecast(rows, metric, horizon)); }
      catch { if (active) setModelError("We could not calculate this forecast. Please retry."); }
    };
    // Calculations stay off the UI thread where Workers are supported.
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
  }, [rows, metric, horizon, retry]);
  const format = (value: number) => metric === "sales" ? money(value) : Number(value.toFixed(1)).toLocaleString("en-PH");
  const chart = useMemo(() => {
    const history = rows.slice(-42).map(row => ({ date: row.date, actual: row[metric], prediction: undefined as number | undefined, band: undefined as [number, number] | undefined }));
    if (result?.status === "ready") {
      if (history.length) history[history.length - 1].prediction = history[history.length - 1].actual;
      return [...history, ...result.points.map(p => ({ date: p.date, actual: undefined, prediction: p.value, band: [p.lower, p.upper] as [number, number] }))];
    }
    return history;
  }, [rows, metric, result]);
  const download = () => {
    if (result?.status !== "ready") return;
    const text = [["Dataset", "Date", "Metric", "Forecast", "Historical error lower", "Historical error upper", "Model"], ...result.points.map(point => [demo ? "SYNTHETIC DEMO - NOT STORE SALES" : "Production eligible settlements", point.date, metric, point.value.toFixed(2), point.lower.toFixed(2), point.upper.toFixed(2), result.model])].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `cozycraft-${demo ? "DEMO-" : ""}forecast-${metric}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="forecast-panel" aria-labelledby="forecast-title" aria-busy={loading && !data}>
    <header className="forecast-heading"><div><p className="intelligence-eyebrow"><ChartNoAxesCombined size={14} aria-hidden="true" /> COZYCRAFT INTELLIGENCE</p><h2 id="forecast-title">A clearer view of what’s next.</h2><p>Machine-learning forecasts, grounded in eligible sales. Planning guidance—not a promise.</p></div><button type="button" className="intelligence-button" disabled={loading} onClick={refresh}><RefreshCw size={15} aria-hidden="true" />{loading ? "Updating…" : "Refresh data"}</button></header>
    <div className="forecast-controls"><div className="forecast-tabs" aria-label="Forecast metric">{(["sales", "orders"] as const).map(value => <button type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}>{value === "sales" ? "Settled sales" : "Settled orders"}</button>)}</div><label>Look ahead<select value={horizon} onChange={e => setHorizon(Number(e.target.value) as 7 | 14)}><option value={7}>7 days</option><option value={14}>14 days</option></select></label><button type="button" className="intelligence-button" aria-pressed={demo} onClick={() => setDemo(v => !v)}>{demo ? "Return to live data" : "Explore model demo"}</button></div>
    {demo && <div className="forecast-demo" role="status"><strong>Demonstration only — synthetic data.</strong> These values are not CozyCraft sales. Nothing is written to your database.</div>}
    {!demo && error && <p className="forecast-error" role="alert">{error} <button type="button" onClick={refresh} disabled={loading}>Retry</button></p>}
    {!demo && data && <p className="forecast-caption"><ShieldCheck size={14} aria-hidden="true" /> Through {data.through} · Philippine time · {data.eligibleOrders} eligible settled orders · {data.excludedTestPayments} test payments excluded</p>}
    {!demo && Boolean(data?.undatedSettlements) && <p className="forecast-demo">{data!.undatedSettlements} paid records lack a usable settlement date and are excluded. Review the payment or delivery history before relying on these forecasts.</p>}
    {(demo || data) && result ? <>
      <div className="forecast-summary"><div><span>{result.status === "ready" ? `Estimated next ${horizon} days${demo ? " · DEMO" : ""}` : "Forecast readiness"}</span><strong>{result.status === "ready" ? format(result.total) : result.status === "insufficient" ? "Building reliable history" : "Review data quality"}</strong></div><div><span>Complete days / active days</span><strong>{result.historyDays} / {result.activeDays}</strong></div><div><span>Selected model</span><b>{result.model}</b></div></div>
      <p className="forecast-caption">{result.reason}</p>
      {chart.length > 0 && <div className="forecast-chart" role="img" aria-label={`${demo ? "Synthetic demonstration. " : ""}${metric === "sales" ? "Settled sales" : "Settled order"} history${result.status === "ready" ? " and forecast with historical error range" : ". No forecast available"}. A data table follows.`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{ top: 20, right: 12, left: 0, bottom: 4 }}><XAxis dataKey="date" tickFormatter={v => String(v).slice(5)} minTickGap={24} tick={{ fontSize: 11 }} /><YAxis width={58} tick={{ fontSize: 10 }} tickFormatter={v => metric === "sales" && v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))} /><Tooltip labelFormatter={v => `${demo ? "DEMO · " : ""}${v}`} formatter={(v: number | number[], name: string) => [Array.isArray(v) ? `${format(v[0])}–${format(v[1])}` : format(Number(v)), name === "actual" ? "Recorded" : name === "band" ? "Historical error range" : "Forecast"]} /><Area dataKey="band" stroke="none" fill="#b9cbb2" fillOpacity={.45} isAnimationActive={false} /><Line type="linear" dataKey="actual" stroke="#796346" strokeWidth={2.5} dot={false} isAnimationActive={false} /><Line type="linear" dataKey="prediction" stroke="#426442" strokeDasharray="6 4" strokeWidth={2.5} dot={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div>}
      <div className="forecast-caption">Solid: recorded · Dashed: forecast · Shaded: historical error range. {metric === "orders" && "Forecast order counts are statistical averages, not guaranteed whole orders."}</div>
      {result.status === "ready" && <><div className="forecast-evaluation"><p><b>Independent holdout error</b><span>{format(result.holdoutMae ?? 0)} per day</span></p><p><b>Recent-average baseline error</b><span>{format(result.baselineMae ?? 0)} per day</span></p><p><b>Selection validation</b><span>{result.validationFolds} chronological windows</span></p></div><button className="intelligence-button" type="button" onClick={download}><ArrowDownToLine size={15} aria-hidden="true" />Download {demo ? "demo " : ""}forecast CSV</button><details className="forecast-details"><summary>View forecast values</summary><div className="forecast-table-scroll"><table><caption>{demo ? "Synthetic demo" : "Production"} forecast · {metric}</caption><thead><tr><th>Date</th><th>Forecast</th><th>Lower guide</th><th>Upper guide</th></tr></thead><tbody>{result.points.map(p => <tr key={p.date}><th>{p.date}</th><td>{format(p.value)}</td><td>{format(p.lower)}</td><td>{format(p.upper)}</td></tr>)}</tbody></table></div></details></>}
      <details className="forecast-details"><summary>How this AI works and what it cannot tell you</summary><p>Ridge regression learns relationships between previous days, weekly patterns and rolling averages. Two regularization settings compete with weekly and recent-average baselines. Chronological validation selects the model; a separate final holdout reports error. Lower error is better. A baseline can legitimately win.</p><p>{data?.basis || "Live forecasts use eligible settlement records, not unpaid checkouts."} COD records have no provider test-mode flag, so staff must keep demonstration COD orders separate from genuine trading.</p><p>Today’s incomplete day is excluded. History is reconciled using current statuses, not archived as-of records. Backtesting is retrospective, not a guarantee of prospective accuracy. Refunds, stockouts, promotions and changing customer demand can affect results. This forecasts retained settlements—not profit, all incoming orders, or unfulfilled demand.</p><p>No external AI provider receives customer data. At most 180 daily aggregates are loaded; calculations run in a background worker where supported. Inputs are cached on the server for 15 minutes. {data && `Snapshot: ${new Date(data.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.`}</p></details>
    </> : !error && <p className="forecast-caption" role="status">{modelError || (loading ? "Loading the protected daily summary…" : "Preparing the forecasting model…")}</p>}
    {modelError && <button className="intelligence-button" type="button" onClick={() => setRetry(v => v + 1)}>Retry calculation</button>}
  </section>;
}
