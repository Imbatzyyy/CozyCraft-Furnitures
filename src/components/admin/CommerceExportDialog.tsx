import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, ShieldCheck } from "lucide-react";
import { Dialog } from "./ui";
import { ALL_COMMERCE_FILTERS, BASIC_REPORT_DETAILS, ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, commerceReportCsv, commerceReportFilename, reportFilterError, reportLabel, type CommerceReportDetails, type CommerceReportFilters, type CommerceReportKind } from "@/lib/admin/commerce-report";
import { downloadReportBlob, loadCommerceReport } from "@/services/admin/commerce-report.service";
import { assertCurrentReportTemplate, REPORT_TEMPLATE_LABEL, ReportTemplateChangedError } from "@/lib/admin/report-template-version";

export function CommerceExportDialog({ kind, userId, initialFilters = ALL_COMMERCE_FILTERS, onClose, onSuccess }: {
  kind: CommerceReportKind; userId: string | null; initialFilters?: CommerceReportFilters; onClose: () => void; onSuccess: (message: string) => void;
}) {
  const [filters, setFilters] = useState({ ...initialFilters });
  const [details, setDetails] = useState<CommerceReportDetails>({ ...BASIC_REPORT_DETAILS });
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [outdated, setOutdated] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const owner = useRef(userId); owner.current = userId;
  useEffect(() => () => controller.current?.abort(), [userId]);
  const update = (key: keyof CommerceReportFilters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const exportFile = async () => {
    if (!userId || controller.current) return;
    const invalid = reportFilterError(filters); if (invalid) { setError(invalid); return; }
    const request = new AbortController(); controller.current = request; const startedBy = userId;
    const timeout = window.setTimeout(() => request.abort(), 120_000);
    setBusy(true); setError(""); setOutdated(false); setProgress(format === "pdf" ? "Checking the latest report layout…" : "Loading matching records…");
    try {
      if (format === "pdf") await assertCurrentReportTemplate(request.signal);
      if (owner.current !== startedBy || request.signal.aborted) return;
      setProgress("Loading matching records…");
      const report = await loadCommerceReport(kind, filters, details, format, request.signal, (count, total) => setProgress(`${count.toLocaleString()} of ${total.toLocaleString()} records prepared`));
      if (owner.current !== startedBy || request.signal.aborted) return;
      setProgress(`Creating ${format.toUpperCase()}…`);
      const blob = format === "pdf" ? await (await import("@/lib/admin/commerce-report-pdf")).commerceReportPdfBlob(report) : new Blob([commerceReportCsv(report)], { type: "text/csv;charset=utf-8" });
      if (owner.current !== startedBy || request.signal.aborted) return;
      downloadReportBlob(blob, commerceReportFilename(report, format));
      onSuccess(`${report.total.toLocaleString()} ${kind} exported as ${format.toUpperCase()}.`); onClose();
    } catch (issue) {
      if (owner.current === startedBy) {
        setOutdated(issue instanceof ReportTemplateChangedError);
        setError(request.signal.aborted ? "Export stopped. Try again or narrow the date range." : issue instanceof Error ? issue.message : "The report could not be exported.");
      }
    } finally { window.clearTimeout(timeout); if (controller.current === request) { controller.current = null; setBusy(false); } }
  };
  const select = (label: string, key: keyof CommerceReportFilters, options: string[][]) => <label className="adm-label min-w-0 text-xs">{label}<select aria-label={label} className="adm-select mt-1 h-11 w-full" disabled={busy} value={filters[key]} onChange={event => update(key, event.target.value)}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  return <Dialog open onClose={onClose} busy={busy} size="max-w-2xl" eyebrow="CozyCraft / Report studio" title={`Export ${kind}`} footer={<>
    <button type="button" className="adm-btn" onClick={() => busy ? controller.current?.abort() : onClose()}>{busy ? "Stop export" : "Cancel"}</button>
    <button type="button" className="adm-btn adm-btn-primary" onClick={() => void exportFile()} disabled={busy || !userId}><Download size={15} />{busy ? "Preparing your report…" : `Download ${format.toUpperCase()}`}</button>
  </>}>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">A clear record of your store, ready to share. Include all matching records across every page, or refine your report below.</p>
    <p className="mt-3 rounded-xl border border-[#cbd4c3] bg-[#f3f6ef] px-3 py-2 text-xs font-semibold text-[#35482d]">{REPORT_TEMPLATE_LABEL}</p>
    <fieldset className="mt-5 grid grid-cols-2 gap-3" disabled={busy}><legend className="mb-2 text-xs font-semibold">File format</legend>{([['pdf', FileText, 'Branded PDF', 'Ready to present or print'], ['csv', FileSpreadsheet, 'Spreadsheet CSV', 'Ready to sort and analyze']] as const).map(([value, Icon, title, description]) => <label key={value} className={`flex cursor-pointer items-start gap-2 rounded-2xl border p-3 sm:gap-3 sm:p-4 ${format === value ? "border-[#526347] bg-[#e8ecdf] text-[#303c29]" : "border-border bg-secondary/30"}`}><input className="mt-1 shrink-0 accent-[#526347]" type="radio" name="report-format" value={value} checked={format === value} onChange={() => setFormat(value)} /><span className="min-w-0"><Icon size={18} className="mb-2" /><b className="block text-xs sm:text-sm">{title}</b><span className="mt-1 block text-[11px] leading-4 opacity-80">{description}</span></span></label>)}</fieldset>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Which records?</h3><button type="button" disabled={busy} onClick={() => setFilters({ ...ALL_COMMERCE_FILTERS })} className="adm-btn adm-btn-sm">All {kind} · reset filters</button></div>
    <fieldset disabled={busy} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
      {select("Order status", "status", [["all", "All order statuses"], ...ORDER_STATUS_OPTIONS.map(value => [value, reportLabel(value)])])}
      {select("Payment status", "paymentStatus", [["all", "All payment statuses"], ...PAYMENT_STATUS_OPTIONS.map(value => [value, reportLabel(value)])])}
      {select("Payment method", "paymentMethod", [["all", "All methods"], ["cod", "Cash on delivery"], ["gcash", "GCash"], ["card", "Debit / credit card"]])}
      {select("Date placed", "dateRange", [["all", "All dates"], ["today", "Today"], ["last_7_days", "Last 7 days"], ["last_30_days", "Last 30 days"], ["custom", "Custom date range"]])}
      {filters.dateRange === "custom" && <><label className="adm-label min-w-0 text-xs">From<input className="adm-input mt-1 h-11 w-full min-w-0" type="date" value={filters.from} onChange={event => update("from", event.target.value)} /></label><label className="adm-label min-w-0 text-xs">Through<input className="adm-input mt-1 h-11 w-full min-w-0" type="date" min={filters.from} value={filters.to} onChange={event => update("to", event.target.value)} /></label></>}
      {select("Payment environment", "scope", [["all", "All environments (shown per record)"], ["live", "Live payments + COD"], ["test", "Test payments"], ["unverified", "No provider environment"]])}
      <label className="adm-label min-w-0 text-xs">Search (optional)<input className="adm-input mt-1 h-11 w-full" type="search" maxLength={150} value={filters.query} onChange={event => update("query", event.target.value)} placeholder="Order, customer, or product" /></label>
      {filters.view !== "all" && <p className="rounded-xl bg-secondary p-3 text-xs sm:col-span-2">Queue: {reportLabel(filters.view)} <button type="button" className="ml-2 underline" onClick={() => update("view", "all")}>Include all queues</button></p>}
    </fieldset>
    <fieldset disabled={busy} className="mt-5 rounded-2xl border border-border bg-secondary/30 p-4"><legend className="px-1 text-xs font-semibold">Additional information</legend><p className="mb-3 text-xs leading-5 text-muted-foreground">Order, customer name, date, statuses, payment method, totals, and payment environment are always included.</p><div className="grid gap-3 sm:grid-cols-2">{([['contact','Customer email and phone'], ['address','Delivery address'], ...(kind === "orders" ? [['items','Products, quantities and prices']] : [])] as Array<[keyof CommerceReportDetails,string]>).map(([key,label]) => <label key={key} className="flex items-start gap-2 text-xs leading-5"><input className="mt-1 accent-[#526347]" type="checkbox" checked={details[key]} onChange={event => setDetails(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}</div></fieldset>
    <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={15} className="mt-0.5 shrink-0" />Dates follow Philippine time. Settled sales count paid, non-cancelled orders. Payment reports show one record per order, including the latest payment reference.</p>
    {busy && <p className="mt-3 text-sm" role="status">{progress}</p>}{error && <p className="mt-3 rounded-xl bg-danger-soft p-3 text-sm text-danger-ink" role="alert">{error}</p>}
    {outdated && <button type="button" className="adm-btn mt-3" disabled={busy} onClick={() => {
      const url = new URL(window.location.href); url.searchParams.set("report-update", String(Date.now())); window.location.replace(url.toString());
    }}>Load latest report page</button>}
  </Dialog>;
}
