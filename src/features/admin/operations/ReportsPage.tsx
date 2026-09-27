import { useEffect, useRef, useState } from "react";
import { ArrowRight, BarChart3, CircleDollarSign, Download, FileSpreadsheet, PackageCheck, Repeat2, TrendingUp, Warehouse } from "lucide-react";
import { adminSupabase as supabase } from "@/services/supabase/client";
import { ForecastPanel } from "@/features/admin/intelligence/ForecastPanel";
import { reportCsv } from "@/lib/intelligence/report-export";
import { reportRangeStart, type AdminReportRange } from "@/lib/admin/metrics";
import { useAdminQuery } from "@/services/admin/use-admin-query";
import { formatDate, formatTime, plural } from "@/lib/admin/format";
import { money, useAdminSession, useStore, Toast } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { RevenueArea } from "@/components/admin/charts";
import { BusyBar, Card, CardHeader, EmptyState, PageHeader, Segmented, Skeleton, StatStrip, Switch, useNotice } from "@/components/admin/ui";

type ReportSummary = {
  start: string;
  generatedAt: string;
  grossSales: number;
  paidCount: number;
  orderCount: number;
  fulfilled: number;
  refundedValue: number;
  cancelledCount: number;
  repeatCustomers: number;
  customerCount: number;
  categoryRevenue: Record<string, number>;
  soldByProduct: Record<string, number>;
  trendData: Array<{ label: string; revenue: number }>;
};

const reports = [
  { name: "Sales performance", meta: "Revenue, order volume and average order value", icon: TrendingUp },
  { name: "Inventory velocity", meta: "Current stock and settled units sold", icon: Warehouse },
  { name: "Customer retention", meta: "All-time paid orders and repeat buyers", icon: Repeat2 },
];
const categoryColors = ["bg-[#8a7358]", "bg-[#6f8a66]", "bg-[#7d8a9f]", "bg-[#b8a58d]", "bg-[#a8a096]"];

export function ReportsPage() {
  const { adminProducts, storeSettings } = useStore();
  const { userId, workspaceReady } = useAdminSession();
  const [range, setRange] = useState<AdminReportRange>("This month");
  const rangeChosen = useRef(false);
  const summary = useAdminQuery<ReportSummary>("admin_reports_summary", { p_range: range }, workspaceReady, userId, { keepPrevious: true });
  const [exporting, setExporting] = useState<string | null>(null);
  const [reportSchedule, setReportSchedule] = useState({ frequency: "weekly", timezone: "Asia/Manila" });
  const { notice, notify, clear } = useNotice();
  const [scheduled, setScheduled] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  useEffect(() => {
    if (!workspaceReady) return;
    let active = true;
    let initialized = false;
    const loadReportSettings = () =>
      void supabase
        .from("store_settings")
        .select("weekly_report_enabled,report_settings")
        .eq("id", true)
        .single()
        .then(({ data }) => {
          if (!active || !data) return;
          setScheduled(Boolean(data?.weekly_report_enabled));
          const configured = data?.report_settings?.default_range;
          if (!initialized && !rangeChosen.current && ["This week", "This month", "Quarter"].includes(configured)) setRange(configured as AdminReportRange);
          initialized = true;
          setReportSchedule({ frequency: data?.report_settings?.frequency ?? "weekly", timezone: data?.report_settings?.timezone ?? "Asia/Manila" });
        });
    loadReportSettings();
    const channel = supabase.channel("admin-reports-settings").on("postgres_changes", { event: "UPDATE", schema: "public", table: "store_settings" }, loadReportSettings).subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [workspaceReady, userId]);
  const data = summary.data;
  const reportNow = new Date();
  const rangeStart = data ? new Date(data.start) : reportRangeStart(range, reportNow);
  const grossSales = data?.grossSales ?? 0;
  const paidCount = data?.paidCount ?? 0;
  const orderCount = data?.orderCount ?? 0;
  const averageOrderValue = paidCount ? grossSales / paidCount : 0;
  const categoryRevenue = Object.entries(data?.categoryRevenue ?? {}).sort((a, b) => b[1] - a[1]);
  const categoryTotal = Math.max(1, categoryRevenue.reduce((sum, [, value]) => sum + value, 0));
  const leadingCategory = categoryRevenue[0]?.[0] ?? "No sales yet";
  const lowStockThreshold = storeSettings.low_stock_threshold ?? 8;
  const lowStockCount = adminProducts.filter((product) => product.status === "active" && (product.stockQuantity ?? 0) <= lowStockThreshold).length;
  const cancellationRate = orderCount ? ((data?.cancelledCount ?? 0) / orderCount) * 100 : 0;
  const reportOwner = useRef(userId);
  reportOwner.current = userId;
  const exportRequest = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      exportRequest.current?.abort();
      exportRequest.current = null;
    },
    [userId],
  );
  const downloadCsv = (name: string, rows: Array<Array<string | number | null>>) => {
    const url = URL.createObjectURL(new Blob([reportCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportReport = async (reportName = "Sales performance") => {
    if (exportRequest.current || !userId) return;
    const owner = userId;
    const controller = new AbortController();
    exportRequest.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 30000);
    setExporting(reportName);
    try {
      const rows: Array<Array<string | number | null>> = [];
      for (let page = 1; page <= 200; page++) {
        const { data: exportData, error } = await supabase.rpc("admin_report_export", { p_report: reportName, p_range: range, p_page: page }).abortSignal(controller.signal);
        if (error || !Array.isArray(exportData?.rows)) throw new Error("Report download failed. Please retry.");
        if (controller.signal.aborted || reportOwner.current !== owner) return;
        if (page === 1) rows.push(exportData.headers);
        rows.push(...exportData.rows);
        if (exportData.rows.length < 250) break;
        if (page === 200) throw new Error("This export is too large. Choose a smaller report period.");
      }
      if (reportOwner.current === owner && !controller.signal.aborted) {
        downloadCsv("cozycraft-" + reportName.toLowerCase().replace(/\s/g, "-") + "-" + range.toLowerCase().replace(/\s/g, "-") + ".csv", rows);
        notify(`${reportName} downloaded from live data.`);
      }
    } catch (issue) {
      if (reportOwner.current === owner) notify(issue instanceof Error ? issue.message : "Export failed.", "error");
    } finally {
      window.clearTimeout(timer);
      if (exportRequest.current === controller) {
        exportRequest.current = null;
        setExporting(null);
      }
    }
  };
  const exportActionReport = () => {
    if (!data) return;
    const priorityProducts = adminProducts.filter((product) => product.status === "active" && (product.stockQuantity ?? 0) <= lowStockThreshold).sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0));
    downloadCsv("cozycraft-inventory-action.csv", [
      ["Product", "Category", "Current stock", "Paid non-cancelled units in range", "Suggested review"],
      ...priorityProducts.map((product) => [product.name, product.category, product.stockQuantity ?? 0, data.soldByProduct[product.id] ?? 0, (product.stockQuantity ?? 0) === 0 ? "Review stock availability" : "Review reorder needs"]),
    ]);
    notify("Inventory review downloaded. Suggestions do not place purchase orders.");
  };
  const toggleSchedule = async (next: boolean) => {
    setScheduleBusy(true);
    const { error } = await supabase.from("store_settings").update({ weekly_report_enabled: next }).eq("id", true);
    setScheduleBusy(false);
    if (error) {
      notify(error.message, "error");
      return;
    }
    setScheduled(next);
    notify(next ? `${reportSchedule.frequency === "monthly" ? "Monthly" : "Weekly"} briefing scheduled.` : "Scheduled briefing paused.");
  };

  return (
    <AdminShell title="Reports">
      <PageHeader
        eyebrow="Executive intelligence"
        title="Reports"
        description={`How the collection is selling, moving, and returning to customers · ${formatDate(rangeStart)} – ${formatDate(reportNow)}`}
        actions={
          <>
            <Segmented label="Report period" value={range} onChange={(value) => { rangeChosen.current = true; setRange(value); }} items={(["This week", "This month", "Quarter"] as AdminReportRange[]).map((item) => ({ value: item, label: item }))} />
            <button onClick={() => void exportReport()} disabled={Boolean(exporting) || !data} className="adm-btn adm-btn-primary"><Download size={14} /> {exporting === "Sales performance" ? "Preparing…" : "Export CSV"}</button>
          </>
        }
      >
        <StatStrip
          loading={!data}
          items={[
            { label: "Gross sales", value: data ? grossSales : null, format: (value) => money(Math.round(value)), note: `${plural(paidCount, "settled order")}`, icon: CircleDollarSign, tone: "success" },
            { label: "Orders fulfilled", value: data?.fulfilled, note: `of ${plural(orderCount, "order")} this period`, icon: PackageCheck },
            { label: "Average order value", value: data ? averageOrderValue : null, format: (value) => money(Math.round(value)), note: `${leadingCategory} leads demand`, icon: BarChart3 },
            { label: "Repeat customers", value: data?.repeatCustomers, note: `All time · ${plural(data?.customerCount ?? 0, "registered customer")}`, icon: Repeat2 },
          ]}
        />
      </PageHeader>
      {summary.error && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning-ink">
          <span>{data ? "Showing the last loaded figures." : "Figures are unavailable, not zero."} {summary.error}</span>
          <button onClick={summary.reload} className="adm-btn adm-btn-sm">Retry</button>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader eyebrow="Revenue pulse" title={`Sales trend · ${range}`} description="Paid sales by period, Philippine calendar days" action={data && <span className="text-[11px] text-muted-foreground">Updated {formatTime(data.generatedAt)}</span>} />
          <BusyBar active={summary.refreshing} />
          <div className="p-3 pr-4 sm:p-5">
            {data ? (
              data.trendData.length ? (
                <RevenueArea data={data.trendData} xKey="label" yKey="revenue" valueLabel="Paid sales" labelPrefix="Period from " format={(value) => money(Math.round(value))} ariaLabel={`Paid sales trend for ${range.toLowerCase()}`} height={260} />
              ) : (
                <EmptyState icon={TrendingUp} title="No paid sales in this period" description="Try a longer period." compact />
              )
            ) : (
              <Skeleton className="h-[260px] w-full" />
            )}
          </div>
          <dl className="grid grid-cols-2 gap-px border-t border-border bg-border text-xs sm:grid-cols-3">
            <div className="bg-card px-5 py-3"><dt className="text-muted-foreground">Refunded</dt><dd className="adm-num mt-0.5 font-semibold">{money(data?.refundedValue ?? 0)}</dd></div>
            <div className="bg-card px-5 py-3"><dt className="text-muted-foreground">Cancellation rate</dt><dd className="adm-num mt-0.5 font-semibold">{cancellationRate.toFixed(1)}%</dd></div>
            <div className="col-span-2 bg-card px-5 py-3 sm:col-span-1"><dt className="text-muted-foreground">Reporting basis</dt><dd className="mt-0.5 font-semibold">Order-created dates</dd></div>
          </dl>
        </Card>
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader eyebrow="Category mix" title="Where revenue comes from" />
            <div className="grid gap-3.5 p-5">
              {data ? (
                categoryRevenue.length ? (
                  categoryRevenue.map(([category, value], index) => (
                    <div key={category}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium">{category}</span>
                        <span className="adm-num text-muted-foreground"><b className="text-foreground">{money(value)}</b> · {Math.round((value / categoryTotal) * 100)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className={`adm-bar-grow h-full rounded-full ${categoryColors[index % categoryColors.length]}`} style={{ width: `${(value / categoryTotal) * 100}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No category sales in this period.</p>
                )
              ) : (
                [0, 1, 2].map((row) => <Skeleton key={row} className="h-7 w-full" />)
              )}
            </div>
          </Card>
          <Card className="bg-subtle p-5">
            <p className="adm-eyebrow">Analyst note</p>
            <h3 className="mt-2 font-serif text-[1.45rem] leading-tight">{data ? `${leadingCategory} currently leads recorded demand.` : "Reading this period…"}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{plural(lowStockCount, "active product")} {lowStockCount === 1 ? "is" : "are"} at or below the {lowStockThreshold}-unit stock alert.</p>
            <button onClick={exportActionReport} disabled={!data} className="adm-btn adm-btn-sm mt-4">Download inventory action list <ArrowRight size={13} /></button>
          </Card>
        </div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="overflow-hidden">
          <CardHeader eyebrow="Report library" title="Ready-made analysis" description={`CSV exports for ${range.toLowerCase()}, generated from live data`} />
          <ul className="divide-y divide-border">
            {reports.map((report) => (
              <li key={report.name} className="flex items-center gap-4 px-5 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary"><report.icon size={17} /></span>
                <div className="min-w-0 flex-1">
                  <b className="block text-[13px]">{report.name}</b>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{report.meta}</span>
                </div>
                <button onClick={() => void exportReport(report.name)} disabled={Boolean(exporting) || !data} className="adm-btn adm-btn-sm">
                  {exporting === report.name ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <FileSpreadsheet size={13} />}
                  {exporting === report.name ? "Preparing…" : "Download"}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <p className="adm-eyebrow">Delivery desk</p>
          <h3 className="mt-1 text-[15px] font-semibold">Scheduled briefing</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">A performance summary arrives as a workspace notification · {reportSchedule.timezone}</p>
          <Switch className="mt-4" checked={scheduled} disabled={scheduleBusy} onChange={(next) => void toggleSchedule(next)} label={`${reportSchedule.frequency === "monthly" ? "Monthly" : "Weekly"} briefing`} description={scheduled ? "Scheduled — change the frequency in Settings → Reports & privacy." : "Paused. Turn on to receive a regular summary."} />
        </Card>
      </div>
      <div className="mt-5">
        <ForecastPanel />
      </div>
      <p className="mt-4 text-[11px] leading-5 text-muted-foreground">Historical reports use order-created dates and include recorded test transactions. The forecast uses stricter settlement eligibility and excludes test-mode payments.</p>
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}
