import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Banknote, CircleDollarSign, CreditCard, Download, Receipt, Wallet } from "lucide-react";
import { adminSupabase as supabase } from "@/services/supabase/client";
import { CommerceExportDialog } from "@/components/admin/CommerceExportDialog";
import { ALL_COMMERCE_FILTERS, ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, reportLabel, type CommerceReportFilters, type CommerceReportPage, type CommerceReportRow } from "@/lib/admin/commerce-report";
import { useAdminQuery } from "@/services/admin/use-admin-query";
import { formatDateTime, plural } from "@/lib/admin/format";
import { money, useAdminSession, Status, Toast } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { confirmAction } from "@/components/admin/confirm";
import { BusyBar, Card, CardHeader, CopyButton, EmptyState, PageHeader, Pagination, Skeleton, StatStrip, useNotice } from "@/components/admin/ui";

const methodIcon = (method: string) => (method === "cod" ? Banknote : method === "gcash" ? Wallet : CreditCard);
const methodLabel = (method: string) => (method === "cod" ? "Cash on delivery" : method === "gcash" ? "GCash" : method === "card" ? "Card" : method.toUpperCase());

export function PaymentsPage() {
  const { userId, workspaceReady } = useAdminSession();
  const [page, setPage] = useState(1);
  const { notice, notify, clear } = useNotice();
  const [exportOpen, setExportOpen] = useState(false);
  const [filters, setFilters] = useState<CommerceReportFilters>({ ...ALL_COMMERCE_FILTERS });
  const [marking, setMarking] = useState<string | null>(null);
  const result = useAdminQuery<CommerceReportPage>("admin_commerce_report_page", { p_kind: "payments", p_filters: filters, p_size: 20, p_page: page }, workspaceReady, userId, { keepPrevious: true });
  const orders = result.data?.rows ?? [];
  useEffect(() => setPage(1), [filters]);
  useEffect(() => {
    if (result.data && !result.loading && page > Math.max(1, Math.ceil(result.data.total / 20))) setPage(Math.max(1, Math.ceil(result.data.total / 20)));
  }, [result.data, result.loading, page]);

  const markReceived = async (order: CommerceReportRow) => {
    const confirmed = await confirmAction({
      title: `Mark #${order.order_number} as paid?`,
      description: `Confirm you have received ${money(Number(order.total))} in cash from ${order.shipping_address.name || "the customer"}. This records the payment as settled.`,
      confirmLabel: "Mark payment received",
      eyebrow: "Cash on delivery",
    });
    if (!confirmed) return;
    setMarking(order.id);
    const { error } = await supabase.from("orders").update({ payment_status: "paid" }).eq("id", order.id);
    setMarking(null);
    if (error) notify(error.message, "error");
    else {
      notify(`Payment for #${order.order_number} marked as received.`);
      result.reload();
    }
  };

  return (
    <AdminShell title="Payments">
      <PageHeader
        eyebrow="Payment reconciliation"
        title="Payments"
        description="Every recorded transaction, newest first. Online payments are settled by PayMongo; cash on delivery is confirmed here."
        actions={
          <button onClick={() => setExportOpen(true)} disabled={!workspaceReady} className="adm-btn adm-btn-primary">
            <Download size={14} /> Export report
          </button>
        }
      >
        <StatStrip
          loading={!result.data}
          items={[
            { label: "Collected", value: result.data ? Number(result.data.summary.settledValue) : null, format: (value) => money(value), note: "Paid, non-cancelled matching orders", icon: CircleDollarSign, tone: "success" },
            { label: "Settled transactions", value: result.data?.summary.settledCount, note: "Paid, non-cancelled matching orders", icon: Receipt },
            { label: "Matching payments", value: result.data?.total, note: "Current filters, across every page", icon: CreditCard },
          ]}
        />
      </PageHeader>
      {exportOpen && <CommerceExportDialog kind="payments" userId={userId} initialFilters={filters} onClose={() => setExportOpen(false)} onSuccess={message => notify(message)} />}

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ["Payment method", "paymentMethod", [["all", "All methods"], ["cod", "Cash on delivery"], ["gcash", "GCash"], ["card", "Debit / credit card"]]],
          ["Payment status", "paymentStatus", [["all", "All payment statuses"], ...PAYMENT_STATUS_OPTIONS.map(value => [value, reportLabel(value)])]],
          ["Order status", "status", [["all", "All order statuses"], ...ORDER_STATUS_OPTIONS.map(value => [value, reportLabel(value)])]],
          ["Date placed", "dateRange", [["all", "All dates"], ["today", "Today"], ["last_7_days", "Last 7 days"], ["last_30_days", "Last 30 days"]]],
        ] as Array<[string, keyof CommerceReportFilters, string[][]]>).map(([label, key, options]) => <label key={key} className="adm-label min-w-0 text-xs">{label}<select aria-label={label} className="adm-select mt-1 h-11 w-full" value={filters[key]} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Filter on the order desk:</span>
        <Link to="/admin/orders?range=all&method=cod&payment=pending&sort=longest_waiting" className="adm-chip"><Banknote size={13} /> COD awaiting cash</Link>
        <Link to="/admin/orders?range=all&view=awaiting_payment" className="adm-chip"><CreditCard size={13} /> Online checkout pending</Link>
        <Link to="/admin/orders?range=all&payment=failed" className="adm-chip">Failed payments</Link>
        <Link to="/admin/orders?range=all&payment=refunded&sort=newest" className="adm-chip">Refunded</Link>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Recorded transactions" description={result.data ? `As of ${formatDateTime(result.data.asOf)}` : "Loading…"} />
        <BusyBar active={result.refreshing} />
        {result.error && !orders.length ? (
          <EmptyState title="Payments could not be loaded." description={result.error} action={<button onClick={result.reload} className="adm-btn adm-btn-primary">Try again</button>} />
        ) : !result.data ? (
          <div className="grid gap-3 p-5">{[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div>
        ) : !orders.length ? (
          <EmptyState icon={Receipt} title="No customer payments yet." description="Checkout payments and cash-on-delivery orders appear here." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className={`adm-table transition-opacity ${result.refreshing ? "opacity-60" : ""}`}>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Method</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="adm-right">Total</th>
                    <th className="adm-right"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const Icon = methodIcon(order.payment_method);
                    const canMark = order.payment_status !== "paid" && order.payment_method === "cod" && order.status !== "cancelled" && order.payment_status !== "refunded";
                    return (
                      <tr key={order.id}>
                        <td>
                          <span className="flex items-center gap-1">
                            <Link to={`/admin/orders?order=${encodeURIComponent(order.id)}&q=${encodeURIComponent(order.id)}&range=all`} className="adm-num font-semibold hover:underline">#{order.order_number}</Link>
                            <CopyButton value={order.order_number} label="order number" />
                          </span>
                        </td>
                        <td className="max-w-[14rem] truncate">{order.shipping_address.name || "Customer"}</td>
                        <td><span className="inline-flex items-center gap-1.5 text-muted-foreground"><Icon size={14} /> {methodLabel(order.payment_method)}</span></td>
                        <td className="adm-num whitespace-nowrap text-muted-foreground">{formatDateTime(order.created_at)}</td>
                        <td><Status>{order.payment_status}</Status></td>
                        <td className="adm-right adm-num font-semibold">{money(Number(order.total))}</td>
                        <td className="adm-right">
                          {canMark ? (
                            <button onClick={() => void markReceived(order)} disabled={marking === order.id} className="adm-btn adm-btn-sm">{marking === order.id ? "Saving…" : "Mark received"}</button>
                          ) : order.payment_method !== "cod" && order.payment_status !== "paid" ? (
                            <span className="text-[10.5px] text-muted-foreground">Managed by PayMongo</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className={`divide-y divide-border transition-opacity md:hidden ${result.refreshing ? "opacity-60" : ""}`}>
              {orders.map((order) => {
                const Icon = methodIcon(order.payment_method);
                const canMark = order.payment_status !== "paid" && order.payment_method === "cod" && order.status !== "cancelled" && order.payment_status !== "refunded";
                return (
                  <li key={order.id} className="flex items-start gap-3 px-4 py-3.5">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><Icon size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/admin/orders?order=${encodeURIComponent(order.id)}&q=${encodeURIComponent(order.id)}&range=all`} className="adm-num text-[13px] font-semibold">#{order.order_number}</Link>
                        <b className="adm-num text-[13px]">{money(Number(order.total))}</b>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{order.shipping_address.name || "Customer"} · {methodLabel(order.payment_method)}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="adm-num text-[11px] text-muted-foreground">{formatDateTime(order.created_at)}</span>
                        {canMark ? <button onClick={() => void markReceived(order)} disabled={marking === order.id} className="adm-btn adm-btn-sm">Mark received</button> : <Status>{order.payment_status}</Status>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {result.data && <Pagination page={page} total={result.data.total} size={20} onChange={setPage} busy={result.refreshing} label="Payment pages" />}
      </Card>
      <p className="mt-3 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        {result.data && `${plural(result.data.total, "transaction")} on record`}
        <Link to="/admin/reports" className="ml-2 inline-flex items-center gap-1 font-semibold text-foreground hover:underline">Revenue reports <ArrowRight size={12} /></Link>
      </p>
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}
