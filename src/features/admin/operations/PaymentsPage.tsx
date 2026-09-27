import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Banknote, CircleDollarSign, CreditCard, Download, Receipt, Wallet } from "lucide-react";
import { adminSupabase as supabase, type DbOrder } from "@/services/supabase/client";
import { reportCsv } from "@/lib/intelligence/report-export";
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
  const [exporting, setExporting] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const result = useAdminQuery<{ rows: DbOrder[]; total: number; collected: number; paidCount: number; asOf: string }>("admin_payment_page", { p_page: page }, workspaceReady, userId, { keepPrevious: true });
  const orders = result.data?.rows ?? [];
  const exportOwner = useRef(userId);
  exportOwner.current = userId;
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => () => exportController.current?.abort(), [userId]);

  const markReceived = async (order: DbOrder) => {
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
  const exportPayments = async () => {
    if (exportController.current || !userId) return;
    const owner = userId;
    const controller = new AbortController();
    exportController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    setExporting(true);
    try {
      const rows: Array<Array<string | number>> = [["Order", "Customer", "Method", "Status", "Total", "Created"]];
      let asOf: string | null = null;
      for (let index = 1; index <= 200; index++) {
        const { data, error } = await supabase.rpc("admin_payment_page", { p_page: index, p_size: 250, p_before: asOf }).abortSignal(controller.signal);
        if (error || !data) throw new Error("The complete settlement report could not be loaded. Please retry.");
        if (exportOwner.current !== owner || controller.signal.aborted) return;
        asOf = data.asOf;
        for (const order of data.rows as DbOrder[]) rows.push([order.order_number, order.shipping_address.name || "Customer", order.payment_method.toUpperCase(), order.payment_status, Number(order.total), order.created_at]);
        if (data.rows.length < 250) break;
        if (index === 200) throw new Error("Use a date-filtered report for exports over 50,000 transactions.");
      }
      const url = URL.createObjectURL(new Blob([reportCsv(rows)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "cozycraft-payments-" + new Date().toISOString().slice(0, 10) + ".csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Complete payment report downloaded.");
    } catch (issue) {
      if (exportOwner.current === owner) notify(issue instanceof Error ? issue.message : "Report export failed.", "error");
    } finally {
      window.clearTimeout(timeout);
      if (exportController.current === controller) {
        exportController.current = null;
        setExporting(false);
      }
    }
  };

  return (
    <AdminShell title="Payments">
      <PageHeader
        eyebrow="Payment reconciliation"
        title="Payments"
        description="Every recorded transaction, newest first. Online payments are settled by PayMongo; cash on delivery is confirmed here."
        actions={
          <button onClick={() => void exportPayments()} disabled={exporting || !result.data} className="adm-btn adm-btn-primary">
            {exporting ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Download size={14} />}
            {exporting ? "Preparing report…" : "Settlement report (CSV)"}
          </button>
        }
      >
        <StatStrip
          loading={!result.data}
          items={[
            { label: "Collected", value: result.data ? Number(result.data.collected) : null, format: (value) => money(Math.round(value)), note: "Settled, non-cancelled payments", icon: CircleDollarSign, tone: "success" },
            { label: "Settled transactions", value: result.data?.paidCount, note: "Paid orders on record", icon: Receipt },
            { label: "All transactions", value: result.data?.total, note: "Every recorded order", icon: CreditCard },
          ]}
        />
      </PageHeader>

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
