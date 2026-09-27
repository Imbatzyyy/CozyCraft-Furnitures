import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Package,
  Phone,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Undo2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import cozyCraftLogo from "@/assets/branding/cozycraft-logo.png";
import { ResilientImage } from "@/components/media/ResilientImage";
import { adminSupabase as supabase, type DbBillingProfile, type DbOrder, type DbPaymentTransaction } from "@/services/supabase/client";
import { canManageFinancialOperations } from "@/lib/admin/access";
import {
  ADMIN_ORDER_VIEW_OPTIONS,
  ADMIN_ORDERS_PER_PAGE,
  DEFAULT_ADMIN_ORDER_FILTERS,
  adminOrderSelectionParams,
  hasActiveAdminOrderFilters,
  type AdminOrderDateRange,
  type AdminOrderDeskFilters,
  type AdminOrderSort,
  type AdminOrderView,
} from "@/lib/admin/order-desk";
import { useAdminQuery } from "@/services/admin/use-admin-query";
import { buildPackingListData } from "@/lib/admin/packing-list";
import { primaryProductImage } from "@/lib/catalog/product-images";
import { allowedFulfillmentStatuses, currentPaymentTransaction } from "@/lib/commerce/order-workflow";
import { allowedReturnStatuses, type ReturnStatus } from "@/lib/commerce/return-workflow";
import { ageLabel, formatDate, formatDateTime, formatTime, hoursSince, humanize, plural } from "@/lib/admin/format";
import { money, useAdminSession, useStore, Status, Toast } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { confirmAction } from "@/components/admin/confirm";
import {
  ActionMenu,
  Avatar,
  BusyBar,
  Card,
  CopyButton,
  Dialog,
  EmptyState,
  LiveBadge,
  PageHeader,
  Pagination,
  Pill,
  SearchField,
  Sheet,
  Skeleton,
  StatStrip,
  isTypingTarget,
  useMediaQuery,
  useNotice,
} from "@/components/admin/ui";

const adminOrderStatuses: Array<DbOrder["status"]> = ["pending", "processing", "packed", "shipped", "delivered", "cancelled"];
const adminPaymentStatuses: Array<DbOrder["payment_status"]> = ["pending", "paid", "failed", "refunded"];
const adminOrderViews = new Set<AdminOrderView>(ADMIN_ORDER_VIEW_OPTIONS.map((option) => option.id));
const adminOrderDateRanges = new Set<AdminOrderDateRange>(["all", "today", "last_7_days", "last_30_days"]);
const adminOrderSorts = new Set<AdminOrderSort>(["newest", "oldest", "highest_total", "longest_waiting"]);
const fulfillmentSteps: DbOrder["status"][] = ["pending", "processing", "packed", "shipped", "delivered"];

function adminOrderFiltersFromParams(params: URLSearchParams): AdminOrderDeskFilters {
  const view = params.get("view") as AdminOrderView | null;
  const status = params.get("status") as DbOrder["status"] | null;
  const paymentStatus = params.get("payment") as DbOrder["payment_status"] | null;
  const dateRange = params.get("range") as AdminOrderDateRange | null;
  const sort = params.get("sort") as AdminOrderSort | null;
  const historicalQueueLink = !dateRange && (params.has("order") || params.has("view"));
  return {
    query: params.get("q") ?? "",
    view: view && adminOrderViews.has(view) ? view : DEFAULT_ADMIN_ORDER_FILTERS.view,
    status: status && adminOrderStatuses.includes(status) ? status : "all",
    paymentStatus: paymentStatus && adminPaymentStatuses.includes(paymentStatus) ? paymentStatus : "all",
    paymentMethod: params.get("method") || "all",
    dateRange: dateRange && adminOrderDateRanges.has(dateRange) ? dateRange : historicalQueueLink ? "all" : DEFAULT_ADMIN_ORDER_FILTERS.dateRange,
    sort: sort && adminOrderSorts.has(sort) ? sort : DEFAULT_ADMIN_ORDER_FILTERS.sort,
  };
}

const nextStepFor = (status: DbOrder["status"]) => {
  const index = fulfillmentSteps.indexOf(status);
  return index >= 0 && index < fulfillmentSteps.length - 1 ? fulfillmentSteps[index + 1] : null;
};
const nextStepLabel: Record<string, string> = {
  pending: "Begin fulfillment",
  processing: "Mark as packed",
  packed: "Mark as shipped",
  shipped: "Mark as delivered",
};
const methodLabel = (method: string) => (method === "cod" ? "Cash on delivery" : method === "gcash" ? "GCash" : method === "card" ? "Card" : method.toUpperCase());
const customerName = (order: DbOrder) => order.shipping_address.name || order.profiles?.full_name || "Customer";
const addressText = (order: DbOrder) =>
  [order.shipping_address.line, order.shipping_address.barangay, order.shipping_address.city, order.shipping_address.province, order.shipping_address.postal].filter(Boolean).join(", ");

function AdminPackingList({ order, printedAt }: { order: DbOrder; printedAt: Date }) {
  const packingList = buildPackingListData(order, printedAt);
  const stamp = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
  return createPortal(
    <section className="admin-packing-list" aria-hidden="true" data-order-number={packingList.orderNumber}>
      <header className="admin-packing-list__header">
        <div>
          <img src={cozyCraftLogo} alt="CozyCraft Furnitures" className="admin-packing-list__logo" />
          <p className="admin-packing-list__eyebrow">FULFILLMENT DOCUMENT</p>
          <h1>Packing list</h1>
        </div>
        <div className="admin-packing-list__order-number">
          <span>ORDER</span>
          <strong>#{packingList.orderNumber}</strong>
        </div>
      </header>
      <div className="admin-packing-list__meta">
        <div><span>Placed</span><strong>{stamp(packingList.placedAt)}</strong></div>
        <div><span>Payment</span><strong>{packingList.paymentSummary}</strong></div>
        <div><span>Contents</span><strong>{packingList.itemCount} {packingList.itemCount === 1 ? "line" : "lines"} · {packingList.unitCount} {packingList.unitCount === 1 ? "unit" : "units"}</strong></div>
        <div><span>Printed</span><strong>{stamp(packingList.printedAt)}</strong></div>
      </div>
      <section className="admin-packing-list__delivery">
        <div>
          <p className="admin-packing-list__eyebrow">DELIVER TO</p>
          <h2>{packingList.customerName}</h2>
          <p>{packingList.deliveryAddress}</p>
        </div>
        <dl>
          <div><dt>Mobile</dt><dd>{packingList.customerMobile}</dd></div>
          <div><dt>Email</dt><dd>{packingList.customerEmail}</dd></div>
        </dl>
      </section>
      <table className="admin-packing-list__items">
        <thead>
          <tr><th scope="col">#</th><th scope="col">Product</th><th scope="col">Product ID</th><th scope="col">Qty</th><th scope="col">Packed</th></tr>
        </thead>
        <tbody>
          {packingList.lines.map((line) => (
            <tr key={`${line.id}-${line.productId}`}>
              <td>{line.id}</td>
              <td><strong>{line.productName}</strong></td>
              <td>{line.productId}</td>
              <td><strong>{line.quantity}</strong></td>
              <td><span className="admin-packing-list__checkbox" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="admin-packing-list__note">
        <p className="admin-packing-list__eyebrow">DELIVERY NOTE</p>
        <p>{packingList.deliveryNote}</p>
      </section>
      <footer className="admin-packing-list__footer">
        <div><span>Prepared by</span><i /></div>
        <div><span>Checked by</span><i /></div>
        <div><span>Date / time</span><i /></div>
        <p>Internal CozyCraft fulfillment document · Reference {packingList.orderId}</p>
      </footer>
    </section>,
    document.body,
  );
}

type ReturnRequest = { id: string; order_id: string; return_number: string; reason: string; details: string; status: string; admin_note: string | null; evidence_paths: string[]; created_at: string };
type QueueData = { orders: DbOrder[]; total: number; allCount: number; today: number; fulfillment: number; awaiting: number; attention: number; paymentMethods: string[] };

export function OrdersWorkspacePage() {
  const { ordersRealtimeConnected, storeSettings, updateOrderStatus, cancelOrder, refreshOrders, adminProducts } = useStore();
  const { role: workspaceRole, userId: adminUserId, workspaceReady } = useAdminSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManageFinancials = canManageFinancialOperations(workspaceRole);
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  // Old notification links name an order but not its page. Open that exact
  // record with a server search; subsequent queue selections do not narrow it.
  useEffect(() => {
    const linked = searchParams.get("order");
    if (linked && !searchParams.has("q")) {
      const next = new URLSearchParams(searchParams);
      next.set("q", linked);
      next.set("range", "all");
      setSearchParams(next, { replace: true });
    }
  }, []);
  const [selectedId, setSelectedId] = useState(() => searchParams.get("order") ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { notice, notify, clear } = useNotice();
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancellationTarget, setCancellationTarget] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [sendingRefundEmail, setSendingRefundEmail] = useState(false);
  const [orderUpdating, setOrderUpdating] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [returnNote, setReturnNote] = useState("");
  const [processingReturnRefund, setProcessingReturnRefund] = useState(false);
  const [invoiceDownloadId, setInvoiceDownloadId] = useState<string | null>(null);
  const [printOrders, setPrintOrders] = useState<DbOrder[]>([]);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const [deskNow, setDeskNow] = useState(() => new Date());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulk, setBulk] = useState<Map<string, DbOrder>>(() => new Map());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set());
  const seenStatuses = useRef(new Map<string, string>());
  const searchParamsKey = searchParams.toString();
  const filters = useMemo(() => adminOrderFiltersFromParams(new URLSearchParams(searchParamsKey)), [searchParamsKey]);
  const [queryDraft, setQueryDraft] = useState(filters.query);
  useEffect(() => setQueryDraft(filters.query), [filters.query]);
  const queueDay = deskNow.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const queue = useAdminQuery<QueueData>("admin_order_queue", { p_filters: filters, p_page: orderPage }, workspaceReady, adminUserId ? `${adminUserId}:${queueDay}` : null, { keepPrevious: true });
  const orders = useMemo(() => queue.data?.orders ?? [], [queue.data]);
  const matchingCount = queue.data?.total ?? 0;
  const allOrderCount = queue.data?.allCount ?? 0;
  const readyToFulfillCount = queue.data?.fulfillment ?? 0;
  const awaitingPaymentCount = queue.data?.awaiting ?? 0;
  const attentionCount = queue.data?.attention ?? 0;
  const todayQueueActive = filters.view === "all" && filters.dateRange === "today";
  const allOrdersActive = filters.view === "all" && filters.dateRange === "all";
  const activeFilterCount = [
    filters.status !== "all",
    filters.paymentStatus !== "all",
    filters.paymentMethod !== "all",
    filters.dateRange !== DEFAULT_ADMIN_ORDER_FILTERS.dateRange,
    filters.sort !== DEFAULT_ADMIN_ORDER_FILTERS.sort,
  ].filter(Boolean).length;
  const queueTitle = todayQueueActive
    ? "Today’s queue"
    : filters.view !== "all"
      ? ADMIN_ORDER_VIEW_OPTIONS.find((option) => option.id === filters.view)?.label ?? "Filtered orders"
      : filters.query
        ? "Search results"
        : "All customer orders";
  const queueSortLabel = filters.sort === "oldest" || filters.sort === "longest_waiting" ? "First placed appears first" : filters.sort === "newest" ? "Most recent appears first" : "Highest total appears first";
  const manilaDateLabel = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" }).format(deskNow);
  const availablePaymentMethods = queue.data?.paymentMethods ?? [];
  const productImages = useMemo(() => new Map(adminProducts.map((product) => [product.id, primaryProductImage(product)])), [adminProducts]);

  const updateDeskParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(changes).forEach(([key, value]) => {
        if (!value) next.delete(key);
        else next.set(key, value);
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  // Search as you type, without a request on every keystroke.
  useEffect(() => {
    if (queryDraft === filters.query) return;
    const timer = window.setTimeout(() => updateDeskParams({ q: queryDraft || null, order: null }), 280);
    return () => window.clearTimeout(timer);
  }, [queryDraft, filters.query, updateDeskParams]);

  const selectOrder = useCallback(
    (orderId: string, openSheet = true) => {
      setSelectedId(orderId);
      setSearchParams(adminOrderSelectionParams(searchParams, orderId, filters.dateRange), { replace: true });
      if (openSheet && !isDesktop) setSheetOpen(true);
    },
    [filters.dateRange, isDesktop, searchParams, setSearchParams],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setDeskNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!workspaceReady || !selectedId) return;
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase.from("return_requests").select("id,order_id,return_number,reason,details,status,admin_note,evidence_paths,created_at").eq("order_id", selectedId).order("created_at", { ascending: false }).limit(1);
      if (active && !error) setReturnRequests((data ?? []) as ReturnRequest[]);
    };
    void refresh();
    const refreshVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const channel = supabase.channel(`admin-return-${selectedId}`).on("postgres_changes", { event: "*", schema: "public", table: "return_requests", filter: `order_id=eq.${selectedId}` }, refresh).subscribe();
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      void supabase.removeChannel(channel);
    };
  }, [selectedId, workspaceReady]);
  useEffect(() => {
    const requestedOrderId = searchParams.get("order");
    if (requestedOrderId && orders.some((order) => order.id === requestedOrderId)) {
      if (selectedId !== requestedOrderId) setSelectedId(requestedOrderId);
      return;
    }
    if (!orders.length) {
      if (selectedId && !queue.refreshing) setSelectedId("");
      return;
    }
    if (!orders.some((order) => order.id === selectedId)) setSelectedId(orders[0].id);
  }, [orders, searchParams, selectedId, queue.refreshing]);
  // Briefly highlight orders whose status changed from a live update.
  useEffect(() => {
    const changed: string[] = [];
    orders.forEach((order) => {
      const previous = seenStatuses.current.get(order.id);
      if (previous && previous !== order.status) changed.push(order.id);
      seenStatuses.current.set(order.id, order.status);
    });
    if (!changed.length) return;
    setFlashIds(new Set(changed));
    const timer = window.setTimeout(() => setFlashIds(new Set()), 1700);
    return () => window.clearTimeout(timer);
  }, [orders]);

  const orderPageCount = Math.max(1, Math.ceil(matchingCount / ADMIN_ORDERS_PER_PAGE));
  useEffect(() => {
    setOrderPage(1);
  }, [filters.dateRange, filters.paymentMethod, filters.paymentStatus, filters.query, filters.sort, filters.status, filters.view]);
  useEffect(() => {
    if (!queue.loading && orderPage > orderPageCount) setOrderPage(orderPageCount);
  }, [orderPage, orderPageCount, queue.loading]);
  const changeOrderPage = (page: number) => {
    setOrderPage(Math.min(Math.max(page, 1), orderPageCount));
  };

  const selected = orders.find((order) => order.id === selectedId) ?? orders[0];
  useEffect(() => {
    setCancellationReason("");
    setReturnNote("");
  }, [selected?.id]);
  useEffect(() => {
    if (showCancellation && cancellationTarget !== JSON.stringify(selected)) {
      setShowCancellation(false);
      notify("The order changed. Please review it before starting cancellation again.", "info");
    }
  }, [selected, showCancellation, cancellationTarget, notify]);
  const selectedPayment = currentPaymentTransaction(selected?.payment_transactions);
  const selectedReturn = selected ? returnRequests.find((request) => request.order_id === selected.id) : undefined;

  const downloadInvoice = async (order: DbOrder) => {
    if (order.status !== "delivered" || invoiceDownloadId) return;
    setInvoiceDownloadId(order.id);
    try {
      const { data: billingProfile, error: billingError } = await supabase
        .from("billing_profiles")
        .select("user_id,recipient_name,company_name,tax_id,invoice_email,address_line,barangay,city,province,postal_code,same_as_delivery")
        .eq("user_id", order.user_id)
        .maybeSingle();
      if (billingError) throw new Error("The customer's invoice details could not be loaded. Please try again.");
      const shipping = order.shipping_address;
      const fallbackBilling: DbBillingProfile = {
        user_id: order.user_id,
        recipient_name: shipping.name ?? order.profiles?.full_name ?? "",
        company_name: "",
        tax_id: "",
        invoice_email: shipping.email ?? order.profiles?.email ?? "",
        address_line: "",
        barangay: "",
        city: "",
        province: "",
        postal_code: "",
        same_as_delivery: true,
      };
      const { downloadOrderInvoicePdf } = await import("@/lib/commerce/order-invoice");
      await downloadOrderInvoicePdf({
        order,
        billing: (billingProfile as DbBillingProfile | null) ?? fallbackBilling,
        customer: { name: shipping.name ?? order.profiles?.full_name ?? "CozyCraft customer", email: shipping.email ?? order.profiles?.email ?? "", phone: shipping.mobile ?? order.profiles?.phone ?? "" },
        store: storeSettings,
      });
      notify(`Invoice receipt for #${order.order_number} downloaded.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "The invoice receipt could not be prepared. Please try again.", "error");
    } finally {
      setInvoiceDownloadId(null);
    }
  };
  const updateReturn = async (status: string) => {
    if (!selectedReturn) return;
    if (status === "refunded") {
      if (!canManageFinancials) {
        notify("An administrator must process financial refunds.", "error");
        return;
      }
      if (!["item_received", "refund_processing"].includes(selectedReturn.status)) {
        notify("Mark the returned item as received before processing its refund.", "error");
        return;
      }
      const confirmed = await confirmAction({
        title: `Refund return ${selectedReturn.return_number}?`,
        description: "The protected refund runs through the payment provider and restores inventory. This cannot be undone here.",
        confirmLabel: "Process refund",
        tone: "danger",
        eyebrow: "Protected action",
      });
      if (!confirmed) return;
      setProcessingReturnRefund(true);
      const { data, error } = await supabase.functions.invoke("process-return-refund", { body: { returnId: selectedReturn.id } });
      setProcessingReturnRefund(false);
      if (data?.error || error) notify(data?.error ?? error?.message ?? "The refund could not be processed.", "error");
      else notify(data?.demo ? `Return ${selectedReturn.return_number} was refunded in demo mode and inventory was restored.` : `Return ${selectedReturn.return_number} was refunded and inventory was restored.`);
      return;
    }
    const { error } = await supabase.from("return_requests").update({ status, admin_note: returnNote.trim() || null, reviewed_at: new Date().toISOString() }).eq("id", selectedReturn.id);
    if (error) notify(error.message, "error");
    else notify(`Return ${selectedReturn.return_number} updated to ${humanize(status).toLowerCase()}.`);
  };
  const openReturnEvidence = async (path: string) => {
    const { data, error } = await supabase.storage.from("return-evidence").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      notify(error?.message ?? "Evidence could not be opened.", "error");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const update = async (status: DbOrder["status"], order: DbOrder | undefined = selected) => {
    if (!order || orderUpdating || status === order.status) return;
    if (status === "cancelled") {
      if (!canManageFinancials) {
        notify("An administrator must approve order cancellations and refunds.", "error");
        return;
      }
      setCancellationReason("");
      setCancellationTarget(JSON.stringify(order));
      setShowCancellation(true);
      return;
    }
    setOrderUpdating(true);
    try {
      const issue = await updateOrderStatus(order.id, status, order.status);
      if (issue) notify(issue, "error");
      else notify(`Order #${order.order_number} is now ${humanize(status).toLowerCase()}.`);
    } catch {
      notify("The status could not be confirmed. Reload the order before trying again.", "error");
      queue.reload();
    } finally {
      setOrderUpdating(false);
    }
  };
  const confirmCancellation = async () => {
    if (!selected || cancellationTarget !== JSON.stringify(selected) || cancellationReason.trim().length < 5) {
      notify("Please provide a clear cancellation reason.", "error");
      return;
    }
    setCancelling(true);
    const issue = await cancelOrder(selected.id, cancellationReason);
    setCancelling(false);
    if (issue) {
      notify(issue, "error");
      return;
    }
    setShowCancellation(false);
    notify(
      selected.payment_status === "paid" && selected.payment_method !== "cod"
        ? `Order #${selected.order_number} was cancelled and its ${methodLabel(selected.payment_method)} refund was recorded.`
        : `Order #${selected.order_number} was cancelled and its inventory was restored.`,
    );
  };
  const rejectCancellationRequest = async () => {
    if (!selected || selected.cancellation_status !== "pending") return;
    if (!canManageFinancials) {
      notify("An administrator must review cancellation requests.", "error");
      return;
    }
    const confirmed = await confirmAction({
      title: "Keep this order going?",
      description: `The cancellation request for #${selected.order_number} will be declined and the customer will be notified.`,
      confirmLabel: "Decline request",
    });
    if (!confirmed) return;
    setCancelling(true);
    const { data, error } = await supabase.functions.invoke("cancel-order", {
      body: { orderId: selected.id, action: "reject", reason: selected.cancellation_reason, note: cancellationReason.trim() || "The order is continuing through fulfillment." },
    });
    setCancelling(false);
    if (error || data?.error) {
      notify(data?.error ?? error?.message ?? "The request could not be reviewed.", "error");
      return;
    }
    setCancellationReason("");
    await refreshOrders();
    queue.reload();
    notify(`Cancellation request for #${selected.order_number} was declined. The customer was notified.`);
  };
  const sendRefundEmail = async () => {
    if (!selected) return;
    if (!canManageFinancials) {
      notify("An administrator must send financial notifications.", "error");
      return;
    }
    setSendingRefundEmail(true);
    const { data, error } = await supabase.functions.invoke("send-refund-email", { body: { orderId: selected.id } });
    setSendingRefundEmail(false);
    if (data?.error || error) notify(data?.error ?? error?.message ?? "The refund email could not be sent.", "error");
    else notify(`Refund confirmation sent to ${data?.recipient ?? "the customer"}.`);
    if (!error && !data?.error) await refreshOrders();
  };
  const print = (list: DbOrder[]) => {
    if (!list.length) return;
    setPrintOrders(list);
    setPrintedAt(new Date());
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  };

  const toggleBulk = (order: DbOrder) =>
    setBulk((current) => {
      const next = new Map(current);
      if (next.has(order.id)) next.delete(order.id);
      else next.set(order.id, order);
      return next;
    });
  const pageAllSelected = orders.length > 0 && orders.every((order) => bulk.has(order.id));
  const togglePage = () =>
    setBulk((current) => {
      const next = new Map(current);
      if (pageAllSelected) orders.forEach((order) => next.delete(order.id));
      else orders.forEach((order) => next.set(order.id, order));
      return next;
    });
  // Keep bulk selections in sync with live order data.
  useEffect(() => {
    setBulk((current) => {
      let changed = false;
      const next = new Map(current);
      orders.forEach((order) => {
        if (next.has(order.id) && next.get(order.id) !== order) {
          next.set(order.id, order);
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [orders]);
  const bulkAdvance = async () => {
    const plan = [...bulk.values()]
      .map((order) => ({ order, next: order.cancellation_status === "pending" ? null : nextStepFor(order.status) }))
      .filter((item): item is { order: DbOrder; next: DbOrder["status"] } => Boolean(item.next));
    if (!plan.length) {
      notify("None of the selected orders can move to a next step.", "info");
      return;
    }
    const byStep = plan.reduce<Record<string, number>>((sum, item) => ({ ...sum, [item.next]: (sum[item.next] ?? 0) + 1 }), {});
    const skipped = bulk.size - plan.length;
    const confirmed = await confirmAction({
      title: `Advance ${plural(plan.length, "order")}?`,
      description: "Each order moves one step forward and the customer is notified. Steps can’t be reversed here.",
      details: (
        <ul className="grid gap-1">
          {Object.entries(byStep).map(([step, count]) => <li key={step} className="flex justify-between"><span>To {humanize(step).toLowerCase()}</span><b className="adm-num">{count}</b></li>)}
          {skipped > 0 && <li className="flex justify-between text-muted-foreground"><span>Skipped (delivered, cancelled, or pending review)</span><b className="adm-num">{skipped}</b></li>}
        </ul>
      ),
      confirmLabel: "Advance orders",
    });
    if (!confirmed) return;
    setBulkBusy(true);
    const failures: string[] = [];
    for (const { order, next } of plan) {
      try {
        const issue = await updateOrderStatus(order.id, next, order.status);
        if (issue) failures.push(`#${order.order_number}: ${issue}`);
      } catch {
        failures.push(`#${order.order_number}: not confirmed`);
      }
    }
    setBulkBusy(false);
    setBulk(new Map());
    queue.reload();
    if (failures.length) notify(`${plan.length - failures.length} advanced. ${failures.length} need another look — ${failures[0]}`, "error");
    else notify(`${plural(plan.length, "order")} advanced to the next step.`);
  };

  // Order desk keyboard shortcuts.
  const selectedIndex = selected ? orders.findIndex((order) => order.id === selected.id) : -1;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const key = event.key.toLowerCase();
      if ((key === "j" || key === "k") && orders.length) {
        event.preventDefault();
        const nextIndex = key === "j" ? Math.min(selectedIndex + 1, orders.length - 1) : Math.max(selectedIndex - 1, 0);
        selectOrder(orders[nextIndex].id, false);
        document.querySelector(`[data-order-row="${orders[nextIndex].id}"]`)?.scrollIntoView({ block: "nearest" });
      }
      if (key === "x" && selected) {
        event.preventDefault();
        toggleBulk(selected);
      }
      if (key === "p" && selected) {
        event.preventDefault();
        print([selected]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const quickViews = [
    { key: "today", label: "Today", count: queue.data?.today ?? null, active: todayQueueActive, params: {} as Record<string, string> },
    ...ADMIN_ORDER_VIEW_OPTIONS.filter((option) => canManageFinancials || !["cancellation_requests", "refund_attention"].includes(option.id)).map((option) => ({
      key: option.id,
      label: option.label,
      count: option.id === "all" ? allOrderCount : option.id === "needs_fulfillment" ? readyToFulfillCount : option.id === "awaiting_payment" ? awaitingPaymentCount : null,
      active: option.id === "all" ? allOrdersActive : filters.view === option.id,
      params: (option.id === "all" ? { range: "all" } : { range: "all", view: option.id }) as Record<string, string>,
    })),
  ];

  const detail = selected ? (
    <OrderDetail
      embedded={!isDesktop}
      order={selected}
      now={deskNow}
      canManageFinancials={canManageFinancials}
      orderUpdating={orderUpdating}
      productImages={productImages}
      payment={selectedPayment}
      returnRequest={selectedReturn}
      returnNote={returnNote}
      setReturnNote={setReturnNote}
      processingReturnRefund={processingReturnRefund}
      invoiceBusy={invoiceDownloadId === selected.id}
      sendingRefundEmail={sendingRefundEmail}
      cancellationNote={cancellationReason}
      setCancellationNote={setCancellationReason}
      cancelling={cancelling}
      onAdvance={() => { const next = nextStepFor(selected.status); if (next) void update(next); }}
      onStatus={(status) => void update(status)}
      onPrint={() => print([selected])}
      onInvoice={() => void downloadInvoice(selected)}
      onRefundEmail={() => void sendRefundEmail()}
      onRejectCancellation={() => void rejectCancellationRequest()}
      onApproveCancellation={() => { setCancellationReason(selected.cancellation_reason || ""); setCancellationTarget(JSON.stringify(selected)); setShowCancellation(true); }}
      onReturnStatus={(status) => void updateReturn(status)}
      onEvidence={(path) => void openReturnEvidence(path)}
    />
  ) : null;

  return (
    <AdminShell title="Orders">
      <PageHeader
        eyebrow="Order operations"
        title="Order desk"
        description={`${manilaDateLabel}. Work from the first order placed to the latest so every customer is handled in sequence.`}
        meta={<LiveBadge live={ordersRealtimeConnected} liveLabel="Live order updates" />}
        actions={
          <>
            <button type="button" onClick={() => { queue.reload(); void refreshOrders(); }} className="adm-btn" aria-label="Refresh orders"><RefreshCw size={14} className={queue.loading ? "animate-spin" : ""} /> <span className="hidden sm:inline">Refresh</span></button>
            {selected && <button type="button" onClick={() => print([selected])} className="adm-btn"><Printer size={14} /> <span className="hidden sm:inline">Print packing list</span></button>}
          </>
        }
      >
        <StatStrip
          loading={!queue.data}
          items={[
            { label: "Today", value: queue.data?.today, note: "Orders placed today", icon: Clock, to: "/admin/orders" },
            { label: "Ready to fulfill", value: readyToFulfillCount, note: "Paid or cash on delivery", icon: Package, tone: readyToFulfillCount ? "inverse" : "neutral", to: "/admin/orders?range=all&view=needs_fulfillment&sort=longest_waiting" },
            { label: "Awaiting payment", value: awaitingPaymentCount, note: "Online checkout pending", icon: CreditCard, tone: awaitingPaymentCount ? "warning" : "neutral", to: "/admin/orders?range=all&view=awaiting_payment" },
            { label: "Needs attention", value: attentionCount, note: "Cancellation or refund", icon: AlertTriangle, tone: attentionCount ? "danger" : "neutral", to: canManageFinancials ? "/admin/orders?range=all&view=cancellation_requests" : undefined },
          ]}
        />
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
          <nav aria-label="Order quick views" className="adm-scroll-x adm-fade-x -mx-1 flex min-w-0 flex-1 gap-1.5 px-1 py-0.5">
            {quickViews.map((view) => (
              <button key={view.key} type="button" data-active={view.active} onClick={() => setSearchParams(new URLSearchParams(view.params), { replace: true })} className="adm-chip">
                {view.label}
                {view.count !== null && <span className="adm-chip-count adm-num">{view.count}</span>}
              </button>
            ))}
          </nav>
          <span className="adm-num shrink-0 text-[11px] text-muted-foreground"><b className="text-foreground">{matchingCount}</b> matching · {allOrderCount} total</span>
        </div>
        <div className="flex flex-col gap-2.5 border-t border-border p-3 sm:flex-row sm:p-4">
          <SearchField className="flex-1" value={queryDraft} onChange={setQueryDraft} label="Search orders" placeholder="Search order, customer, email, phone, or product" />
          <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} data-active={filtersOpen} className={`adm-btn h-11 ${filtersOpen ? "!border-foreground" : ""}`}>
            <SlidersHorizontal size={15} /> Filters
            {activeFilterCount > 0 && <span className="adm-chip-count adm-num">{activeFilterCount}</span>}
            <ChevronDown size={14} className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        <div className="adm-collapse" data-open={filtersOpen} aria-hidden={!filtersOpen}>
          <div>
            <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-5">
              {([
                ["Fulfillment", filters.status, "status", [["all", "All statuses"], ...adminOrderStatuses.map((status) => [status, humanize(status)])]],
                ["Payment", filters.paymentStatus, "payment", [["all", "All payments"], ...adminPaymentStatuses.map((status) => [status, humanize(status)])]],
                ["Method", filters.paymentMethod, "method", [["all", "All methods"], ...availablePaymentMethods.map((method) => [method, methodLabel(method)])]],
                ["Date", filters.dateRange, "range", [["today", "Today"], ["all", "Any date"], ["last_7_days", "Last 7 days"], ["last_30_days", "Last 30 days"]]],
                ["Order", filters.sort, "sort", [["oldest", "First placed first"], ["newest", "Most recent first"], ["longest_waiting", "Longest waiting"], ["highest_total", "Highest total"]]],
              ] as Array<[string, string, string, string[][]]>).map(([label, value, param, options]) => (
                <label key={param} className="adm-label text-[11px] text-muted-foreground">
                  {label}
                  <select
                    tabIndex={filtersOpen ? undefined : -1}
                    value={value}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const isDefault = (param === "range" && raw === "today") || (param === "sort" && raw === "oldest") || raw === "all";
                      updateDeskParams({ [param]: isDefault ? null : raw, order: null });
                    }}
                    className="adm-select h-10 text-xs font-semibold text-foreground"
                  >
                    {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </div>
        {hasActiveAdminOrderFilters(filters) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-subtle/60 px-4 py-2.5">
            <p className="text-[11px] text-muted-foreground">Searching all matching orders · {ADMIN_ORDERS_PER_PAGE} per page</p>
            <button type="button" onClick={() => setSearchParams({}, { replace: true })} className="adm-btn adm-btn-ghost adm-btn-sm"><Undo2 size={13} /> Reset to today’s queue</button>
          </div>
        )}
        <BusyBar active={queue.refreshing} />
      </Card>

      {queue.error && orders.length > 0 && (
        <div role="alert" className="mt-4 flex flex-col gap-2 rounded-2xl border border-border bg-warning-soft px-4 py-3 text-xs text-warning-ink sm:flex-row sm:items-center sm:justify-between">
          <span>Showing the last loaded orders. Live refresh reported: {queue.error}</span>
          <button type="button" onClick={queue.reload} className="adm-btn adm-btn-sm">Try again</button>
        </div>
      )}

      {!queue.data && !queue.error ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]" role="status" aria-label="Loading orders">
          <Card className="grid gap-3 p-4">{[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-20 w-full" />)}</Card>
          <Card className="hidden gap-4 p-5 xl:grid"><Skeleton className="h-8 w-56" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></Card>
        </div>
      ) : !orders.length ? (
        <Card className="mt-5">
          {queue.error ? (
            <EmptyState icon={Clock} title="We couldn’t finish loading the order desk." description={queue.error} action={<button type="button" onClick={queue.reload} className="adm-btn adm-btn-primary">Retry orders</button>} />
          ) : (
            <EmptyState
              icon={allOrderCount ? Search : Package}
              title={allOrderCount ? "No orders match this view." : "No customer orders yet."}
              description={allOrderCount ? "Try another date or clear your filters." : "New storefront and mobile orders will appear here automatically."}
              action={allOrderCount > 0 && (<><button type="button" onClick={() => setSearchParams({}, { replace: true })} className="adm-btn">Return to today</button><button type="button" onClick={() => setSearchParams({ range: "all" }, { replace: true })} className="adm-btn adm-btn-primary">Show all orders</button></>)}
            />
          )}
        </Card>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:items-start">
          <Card className="overflow-hidden xl:sticky xl:top-[5.25rem]">
            <div className="flex items-center gap-3 border-b border-border bg-subtle/70 px-4 py-3">
              <input type="checkbox" className="adm-check" checked={pageAllSelected} onChange={togglePage} aria-label="Select every order on this page" />
              <div className="min-w-0 flex-1">
                <b className="block text-[13px]">{queueTitle}</b>
                <span className="block text-[10.5px] text-muted-foreground">{queueSortLabel}</span>
              </div>
              <span className="adm-num rounded-full bg-card px-2.5 py-1 text-[10.5px] font-semibold shadow-sm">{matchingCount}</span>
            </div>
            <ul className={`max-h-none divide-y divide-border transition-opacity xl:max-h-[calc(100dvh-16rem)] xl:overflow-y-auto xl:overscroll-contain ${queue.refreshing ? "opacity-60" : ""}`}>
              {orders.map((order, index) => {
                const position = (orderPage - 1) * ADMIN_ORDERS_PER_PAGE + index + 1;
                const active = selected?.id === order.id;
                const waiting = ["pending", "processing", "packed"].includes(order.status) ? hoursSince(order.created_at, deskNow) : 0;
                const checked = bulk.has(order.id);
                return (
                  <li key={order.id} data-order-row={order.id} className={`relative transition-colors ${active ? "bg-brand/25" : "hover:bg-subtle"} ${flashIds.has(order.id) ? "adm-flash" : ""}`}>
                    {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-foreground" aria-hidden="true" />}
                    <input type="checkbox" className="adm-check absolute left-4 top-[1.15rem] z-[1]" checked={checked} onChange={() => toggleBulk(order)} aria-label={`Select order ${order.order_number}`} />
                    <button type="button" onClick={() => selectOrder(order.id)} aria-current={active ? "true" : undefined} className="block w-full py-3.5 pl-11 pr-4 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="adm-num text-[10px] font-semibold text-muted-foreground">{position}</span>
                          <b className="adm-num truncate text-[13px]">#{order.order_number}</b>
                        </span>
                        <Status>{humanize(order.status)}</Status>
                      </div>
                      <p className="mt-1 truncate text-[13px] font-medium">{customerName(order)}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="adm-num">{todayQueueActive ? formatTime(order.created_at) : `${formatDate(order.created_at)} · ${formatTime(order.created_at)}`}</span>
                          <span>· {plural(order.order_items.length, "item")}</span>
                          {waiting >= 24 && <Pill tone={waiting >= 48 ? "danger" : "warning"} className="!text-[9.5px]">Waiting {ageLabel(order.created_at, deskNow)}</Pill>}
                          {order.cancellation_status === "pending" && <Pill tone="danger" className="!text-[9.5px]">Cancel request</Pill>}
                        </span>
                        <b className="adm-num shrink-0 text-xs text-foreground">{money(Number(order.total))}</b>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pagination page={orderPage} total={matchingCount} size={ADMIN_ORDERS_PER_PAGE} onChange={changeOrderPage} busy={queue.refreshing} label="Order queue pages" />
          </Card>
          {isDesktop && <div className="min-w-0">{detail}</div>}
        </div>
      )}

      {!isDesktop && selected && (
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          eyebrow={queueTitle}
          title={`Order #${selected.order_number}`}
          width="max-w-3xl"
          footer={
            nextStepFor(selected.status) && selected.cancellation_status !== "pending" ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => print([selected])} className="adm-btn adm-btn-icon" aria-label="Print packing list"><Printer size={16} /></button>
                <button type="button" onClick={() => { const next = nextStepFor(selected.status); if (next) void update(next); }} disabled={orderUpdating} className="adm-btn adm-btn-primary h-11 flex-1">{orderUpdating ? "Updating…" : nextStepLabel[selected.status]}</button>
              </div>
            ) : undefined
          }
        >
          {detail}
        </Sheet>
      )}

      {bulk.size > 0 && (
        <div className="cc-enter-up fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-2xl bg-[#201f1d] p-2 pl-4 text-white shadow-[var(--adm-shadow-pop)] ring-1 ring-white/10 sm:bottom-5">
          <b className="adm-num mr-auto text-sm">{plural(bulk.size, "order")} selected</b>
          <button type="button" onClick={() => print([...bulk.values()])} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold hover:bg-white/10"><Printer size={14} /> Print</button>
          <button type="button" onClick={() => void bulkAdvance()} disabled={bulkBusy} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-[#201f1d] disabled:opacity-60">{bulkBusy ? "Updating…" : <>Advance <ArrowRight size={14} /></>}</button>
          <button type="button" onClick={() => setBulk(new Map())} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10" aria-label="Clear selection"><X size={15} /></button>
        </div>
      )}

      <Dialog
        open={Boolean(canManageFinancials && showCancellation && selected)}
        onClose={() => setShowCancellation(false)}
        busy={cancelling}
        eyebrow="Protected action"
        title={selected ? `Cancel order #${selected.order_number}?` : "Cancel order"}
        footer={
          <>
            <button onClick={() => setShowCancellation(false)} disabled={cancelling} className="adm-btn">Keep order</button>
            <button onClick={() => void confirmCancellation()} disabled={cancelling || cancellationReason.trim().length < 5} className="adm-btn adm-btn-danger">
              {cancelling ? "Processing safely…" : selected?.payment_status === "paid" && selected.payment_method !== "cod" ? "Cancel and refund" : "Confirm cancellation"}
            </button>
          </>
        }
      >
        {selected && (
          <>
            <div className="rounded-xl border border-border bg-subtle p-4 text-sm leading-6">
              {selected.payment_status === "paid" && selected.payment_method !== "cod" ? (
                <><b>Paid {methodLabel(selected.payment_method)} order.</b> A full refund of <span className="adm-num">{money(Number(selected.total))}</span> will be {selected.refund_status === "demo_succeeded" ? "recorded" : "initiated"} before inventory is restored.</>
              ) : (
                <><b>No settled online payment.</b> The order will be cancelled and reserved inventory will be restored.</>
              )}
            </div>
            <label className="adm-label mt-4">
              Cancellation reason
              <textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} maxLength={500} rows={4} placeholder="Explain why this order must be cancelled…" className="adm-textarea font-normal" />
              <span className="adm-hint">At least 5 characters. Shipped and delivered orders need the return workflow instead.</span>
            </label>
          </>
        )}
      </Dialog>

      {printOrders.map((order) => <AdminPackingList key={order.id} order={order} printedAt={printedAt} />)}
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}

type PaymentRecord = DbPaymentTransaction | undefined;

function OrderDetail({
  embedded = false,
  order,
  now,
  canManageFinancials,
  orderUpdating,
  productImages,
  payment,
  returnRequest,
  returnNote,
  setReturnNote,
  processingReturnRefund,
  invoiceBusy,
  sendingRefundEmail,
  cancellationNote,
  setCancellationNote,
  cancelling,
  onAdvance,
  onStatus,
  onPrint,
  onInvoice,
  onRefundEmail,
  onRejectCancellation,
  onApproveCancellation,
  onReturnStatus,
  onEvidence,
}: {
  embedded?: boolean;
  order: DbOrder;
  now: Date;
  canManageFinancials: boolean;
  orderUpdating: boolean;
  productImages: Map<string, string>;
  payment: PaymentRecord;
  returnRequest?: ReturnRequest;
  returnNote: string;
  setReturnNote: (value: string) => void;
  processingReturnRefund: boolean;
  invoiceBusy: boolean;
  sendingRefundEmail: boolean;
  cancellationNote: string;
  setCancellationNote: (value: string) => void;
  cancelling: boolean;
  onAdvance: () => void;
  onStatus: (status: DbOrder["status"]) => void;
  onPrint: () => void;
  onInvoice: () => void;
  onRefundEmail: () => void;
  onRejectCancellation: () => void;
  onApproveCancellation: () => void;
  onReturnStatus: (status: string) => void;
  onEvidence: (path: string) => void;
}) {
  const next = nextStepFor(order.status);
  const currentIndex = fulfillmentSteps.indexOf(order.status);
  const cancelled = order.status === "cancelled";
  const name = customerName(order);
  const email = order.profiles?.email || order.shipping_address.email || "";
  const phone = order.shipping_address.mobile || order.profiles?.phone || "";
  const address = addressText(order);
  const units = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const moveOptions = allowedFulfillmentStatuses(order.status).filter((status) => status !== order.status && (canManageFinancials || status !== "cancelled"));
  const waiting = ["pending", "processing", "packed"].includes(order.status) ? hoursSince(order.created_at, now) : 0;
  const section = (title: string, children: ReactNode, action?: ReactNode) => (
    <section className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-2"><p className="adm-eyebrow">{title}</p>{action}</div>
      {children}
    </section>
  );
  return (
    <Card key={order.id} className={`adm-swap overflow-hidden ${embedded ? "!rounded-none !border-0 !shadow-none" : ""}`}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {!embedded && <h2 className="adm-num text-xl font-semibold tracking-[-.01em]">#{order.order_number}</h2>}
            <CopyButton value={order.order_number} label="order number" />
            <Status>{humanize(order.status)}</Status>
            {waiting >= 24 && <Pill tone={waiting >= 48 ? "danger" : "warning"}>Waiting {ageLabel(order.created_at, now)}</Pill>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Placed {formatDateTime(order.created_at)} · {plural(units, "unit")} · <span className="adm-num font-semibold text-foreground">{money(Number(order.total))}</span></p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onPrint} className="adm-btn hidden sm:inline-flex"><Printer size={14} /> Print</button>
          {next && !cancelled && (
            <button type="button" onClick={onAdvance} disabled={orderUpdating || order.cancellation_status === "pending"} className="adm-btn adm-btn-primary hidden sm:inline-flex">
              {orderUpdating ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check size={14} />}
              {nextStepLabel[order.status]}
            </button>
          )}
          <ActionMenu
            label={`More actions for order ${order.order_number}`}
            items={[
              { label: "Print packing list", icon: Printer, onSelect: onPrint, hint: "P" },
              ...(order.status === "delivered" ? [{ label: invoiceBusy ? "Preparing invoice…" : "Download invoice PDF", icon: Download, onSelect: onInvoice, disabled: invoiceBusy }] : []),
              ...(email ? [{ label: "Email customer", icon: Mail, onSelect: () => { window.location.href = `mailto:${email}?subject=${encodeURIComponent(`Your CozyCraft order #${order.order_number}`)}`; } }] : []),
              ...(moveOptions.includes("cancelled") ? [{ label: "Cancel order…", icon: XCircle, onSelect: () => onStatus("cancelled"), tone: "danger" as const }] : []),
            ]}
          />
        </div>
      </div>

      {order.cancellation_status && (
        <div className={`border-b border-border px-4 py-4 sm:px-5 ${order.cancellation_status === "pending" ? "bg-warning-soft text-warning-ink" : order.cancellation_status === "approved" ? "bg-success-soft text-success-ink" : "bg-secondary text-muted-foreground"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em]">Cancellation {order.cancellation_status}</p>
              <p className="mt-1.5 text-sm font-semibold">{order.cancellation_reason || "No reason provided"}</p>
              {order.cancellation_requested_at && <time className="mt-1 block text-[11px]" dateTime={order.cancellation_requested_at}>Requested {formatDateTime(order.cancellation_requested_at)}</time>}
              {order.cancellation_decision_note && <p className="mt-2 text-xs">Decision note: {order.cancellation_decision_note}</p>}
            </div>
          </div>
          {order.cancellation_status === "pending" && canManageFinancials && (
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <label className="adm-label text-foreground">
                Note to customer
                <input value={cancellationNote} onChange={(event) => setCancellationNote(event.target.value)} maxLength={500} placeholder="Optional note for the customer" className="adm-input h-10 bg-card font-normal" />
              </label>
              <button type="button" disabled={cancelling} onClick={onRejectCancellation} className="adm-btn h-10">Decline request</button>
              <button type="button" disabled={cancelling} onClick={onApproveCancellation} className="adm-btn adm-btn-danger h-10">Approve &amp; cancel</button>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {section(
            "Delivery progress",
            cancelled ? (
              <div className="flex items-center gap-3 rounded-xl bg-danger-soft p-3 text-sm text-danger-ink"><XCircle size={18} /> This order was cancelled{order.refund_status ? ` · refund ${humanize(order.refund_status).toLowerCase()}` : ""}.</div>
            ) : (
              <ol className="grid grid-cols-5 gap-1">
                {fulfillmentSteps.map((step, index) => {
                  const complete = index <= currentIndex;
                  const current = index === currentIndex;
                  const history = order.order_status_history?.find((entry) => entry.status === step);
                  return (
                    <li key={step} className="relative min-w-0 text-center">
                      {index > 0 && <span className={`absolute right-1/2 top-[11px] h-0.5 w-full ${index <= currentIndex ? "bg-foreground" : "bg-border"}`} aria-hidden="true" />}
                      <span className={`relative z-[1] mx-auto grid h-6 w-6 place-items-center rounded-full border-2 transition-colors ${complete ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"} ${current ? "ring-4 ring-brand/50" : ""}`}>
                        {complete ? <Check size={12} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      <b className={`mt-1.5 block truncate text-[11px] ${complete ? "" : "font-medium text-muted-foreground"}`}>{humanize(step)}</b>
                      {history && <time className="block truncate text-[10px] text-muted-foreground" dateTime={history.changed_at}>{formatDate(history.changed_at).replace(/, \d{4}$/, "")} {formatTime(history.changed_at)}</time>}
                    </li>
                  );
                })}
              </ol>
            ),
            moveOptions.length > 0 && (
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="sr-only sm:not-sr-only">Move to</span>
                <select
                  value=""
                  aria-label={`Move order ${order.order_number} to another status`}
                  disabled={orderUpdating || order.cancellation_status === "pending"}
                  onChange={(event) => { if (event.target.value) onStatus(event.target.value as DbOrder["status"]); }}
                  className="adm-select h-8 min-h-0 w-auto py-0 pl-2.5 text-[11px] font-semibold text-foreground"
                >
                  <option value="">Choose…</option>
                  {moveOptions.map((status) => <option key={status} value={status}>{status === "cancelled" ? "Cancel order…" : humanize(status)}</option>)}
                </select>
              </label>
            ),
          )}
          {section(
            `Items · ${plural(units, "unit")}`,
            <>
              <ul className="grid gap-2">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-subtle/60 p-2 pr-3">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {item.product_id && productImages.get(item.product_id) ? <ResilientImage src={productImages.get(item.product_id)!} alt="" className="h-full w-full object-cover" /> : <Package size={16} className="m-auto mt-4 text-muted-foreground" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13px]">{item.product_name}</b>
                      <span className="adm-num block text-[11px] text-muted-foreground">{item.quantity} × {money(Number(item.unit_price))}</span>
                    </span>
                    <b className="adm-num text-[13px]">{money(Number(item.unit_price) * item.quantity)}</b>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 grid gap-1.5 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Merchandise subtotal</dt><dd className="adm-num font-semibold">{money(Number(order.subtotal))}</dd></div>
                {Number(order.reward_discount ?? 0) > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Reward discount</dt><dd className="adm-num font-semibold text-success-ink">−{money(Number(order.reward_discount))}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Delivery{order.shipping_address.delivery_area_name ? ` · ${order.shipping_address.delivery_area_name}` : ""}</dt><dd className="adm-num font-semibold">{Number(order.delivery_fee) > 0 ? money(Number(order.delivery_fee)) : "Free"}</dd></div>
                <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2 text-sm"><dt className="font-semibold">Order total</dt><dd className="adm-num font-bold">{money(Number(order.total))}</dd></div>
              </dl>
            </>,
          )}
          {section(
            "Payment",
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="adm-inset p-3">
                  <span className="text-[10.5px] text-muted-foreground">Method · status</span>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold">{methodLabel(order.payment_method)} <Status>{order.payment_status}</Status></p>
                  {payment?.paid_at && <time className="mt-1 block text-[10.5px] text-muted-foreground" dateTime={payment.paid_at}>Paid {formatDateTime(payment.paid_at)}</time>}
                </div>
                <div className="adm-inset p-3">
                  <span className="text-[10.5px] text-muted-foreground">Provider record</span>
                  <p className="mt-1 text-sm font-semibold">{order.payment_method === "cod" ? "Collected on delivery" : humanize(payment?.status ?? "Awaiting provider")}</p>
                  {payment?.updated_at && <time className="mt-1 block text-[10.5px] text-muted-foreground" dateTime={payment.updated_at}>Synced {formatDateTime(payment.updated_at)}</time>}
                  {payment?.failure_reason && <span className="mt-1 block text-[10.5px] text-danger-ink">{payment.failure_reason}</span>}
                </div>
              </div>
              {order.refund_status && (
                <div className={`mt-3 rounded-xl p-3 text-xs ${order.refund_status === "failed" ? "bg-danger-soft text-danger-ink" : "bg-success-soft text-success-ink"}`}>
                  <b className="block">Refund {humanize(order.refund_status).toLowerCase()}</b>
                  {order.refunded_at && <time className="mt-1 block" dateTime={order.refunded_at}>Completed {formatDateTime(order.refunded_at)}</time>}
                  {canManageFinancials && order.payment_status === "refunded" && (
                    <button type="button" onClick={onRefundEmail} disabled={sendingRefundEmail} className="adm-btn adm-btn-sm mt-3">
                      <Mail size={13} /> {sendingRefundEmail ? "Sending…" : order.refund_email_sent_at ? "Resend refund email" : "Send refund email"}
                    </button>
                  )}
                </div>
              )}
            </>,
          )}
          {order.status === "delivered" &&
            section(
              "Digital invoice",
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-subtle/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-background"><FileText size={16} /></span>
                  <p className="text-xs leading-5 text-muted-foreground">The same receipt the customer receives — items, fees, discounts, payment and delivery details.</p>
                </div>
                <button type="button" onClick={onInvoice} disabled={invoiceBusy} className="adm-btn adm-btn-primary shrink-0">
                  {invoiceBusy ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Preparing…</> : <><Download size={14} /> Download PDF</>}
                </button>
              </div>,
            )}
        </div>
        <aside className="min-w-0 border-t border-border bg-subtle/50 lg:border-l lg:border-t-0">
          {section(
            "Customer",
            <div>
              <div className="flex items-center gap-3">
                <Avatar name={name} />
                <div className="min-w-0">
                  <b className="block truncate text-sm">{name}</b>
                  <span className="block truncate text-[11px] text-muted-foreground">Storefront buyer</span>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-xs">
                <div>
                  <dt className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground"><Mail size={12} /> Email</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-medium">{email ? <><a href={`mailto:${email}`} className="min-w-0 truncate hover:underline">{email}</a><CopyButton value={email} label="email" /></> : "Not provided"}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground"><Phone size={12} /> Mobile</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-medium">{phone ? <><a href={`tel:${phone.replace(/\s+/g, "")}`} className="adm-num hover:underline">{phone}</a><CopyButton value={phone} label="mobile number" /></> : "Not provided"}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground"><MapPin size={12} /> Deliver to</dt>
                  <dd className="mt-0.5 flex items-start gap-1 font-medium leading-5">{address ? <><span className="min-w-0">{address}</span><CopyButton value={address} label="address" className="mt-px" /></> : "Not provided"}</dd>
                </div>
              </dl>
              <div className="mt-4 grid gap-2">
                <Link to={`/admin/customers?q=${encodeURIComponent(email || name)}`} className="adm-btn adm-btn-sm justify-start"><UserRound size={13} /> Customer profile <ArrowRight size={12} className="ml-auto" /></Link>
                <Link to={`/admin/orders?range=all&sort=newest&q=${encodeURIComponent(email || name)}`} className="adm-btn adm-btn-sm justify-start"><ExternalLink size={13} /> All orders from {name.split(" ")[0]} <ArrowRight size={12} className="ml-auto" /></Link>
              </div>
            </div>,
          )}
          {returnRequest &&
            section(
              `Return ${returnRequest.return_number}`,
              <div className="text-xs">
                <Status>{humanize(returnRequest.status)}</Status>
                <p className="mt-2 font-semibold">{returnRequest.reason}</p>
                <p className="mt-1 leading-5 text-muted-foreground">{returnRequest.details}</p>
                {returnRequest.evidence_paths?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {returnRequest.evidence_paths.map((path, index) => <button key={path} type="button" onClick={() => onEvidence(path)} className="adm-btn adm-btn-sm">Evidence {index + 1} <ExternalLink size={12} /></button>)}
                  </div>
                )}
                <label className="adm-label mt-3">
                  Note to customer
                  <textarea value={returnNote} onChange={(event) => setReturnNote(event.target.value)} placeholder="Sent with the next status change…" rows={3} className="adm-textarea bg-card text-xs font-normal" />
                </label>
                <label className="adm-label mt-2">
                  Update return
                  <select value="" disabled={processingReturnRefund || returnRequest.status === "closed"} onChange={(event) => { if (event.target.value) onReturnStatus(event.target.value); }} className="adm-select h-10 bg-card text-xs font-semibold">
                    <option value="">{processingReturnRefund ? "Processing refund…" : "Choose next step…"}</option>
                    {allowedReturnStatuses(returnRequest.status as ReturnStatus).filter((status) => status !== "refund_processing" && status !== "refunded" && status !== returnRequest.status).map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
                    {canManageFinancials && ["item_received", "refund_processing"].includes(returnRequest.status) && <option value="refunded">Process protected refund…</option>}
                  </select>
                </label>
              </div>,
            )}
        </aside>
      </div>
    </Card>
  );
}
