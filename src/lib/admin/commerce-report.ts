import { reportCsv } from "@/lib/intelligence/report-export";
import type { AdminOrderDeskFilters } from "./order-desk";

export type CommerceReportKind = "orders" | "payments";
export type CommerceReportFilters = {
  status: string; paymentStatus: string; paymentMethod: string; dateRange: string;
  from: string; to: string; query: string; scope: string; view: string;
};
export type CommerceReportDetails = { contact: boolean; address: boolean; items: boolean };
export const ALL_COMMERCE_FILTERS: CommerceReportFilters = {
  status: "all", paymentStatus: "all", paymentMethod: "all", dateRange: "all", from: "", to: "", query: "", scope: "all", view: "all",
};
export const BASIC_REPORT_DETAILS: CommerceReportDetails = { contact: false, address: false, items: false };
export const ORDER_STATUS_OPTIONS = ["pending", "processing", "packed", "shipped", "delivered", "cancelled"];
export const PAYMENT_STATUS_OPTIONS = ["pending", "paid", "failed", "refunded"];
export const reportLabel = (value: string) => ({ cod: "Cash on delivery", gcash: "GCash", live: "Live payments + COD", test: "Test payments", unverified: "No provider environment", all: "All" }[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
export const reportEnvironmentLabel = (value: string) => ({ live: "Live payment", test: "Test payment", cod: "Cash on delivery", unverified: "No provider environment" }[value] ?? reportLabel(value));
export const filtersFromOrderDesk = (filters: AdminOrderDeskFilters): CommerceReportFilters => ({ ...ALL_COMMERCE_FILTERS, ...filters });
export type CommerceReportRow = {
  id: string; order_number: string; created_at: string; status: string; payment_method: string; payment_status: string;
  total: number; subtotal: number; delivery_fee: number; discount: number; shipping_address: { name: string };
  environment: string; payment_reference: string; paid_at: string | null;
  email?: string; mobile?: string; address?: string; items?: { name: string; quantity: number; unit_price: number }[];
};
export type CommerceReportPage = {
  rows: CommerceReportRow[]; total: number; hasMore: boolean; nextCursor: { id: string; created_at: string } | null;
  asOf: string; snapshotKey: string;
  summary: { totalValue: number; settledValue: number; settledCount: number; pendingValue: number; refundedValue: number; cancelledCount: number };
};
export type CommerceReport = Omit<CommerceReportPage, "hasMore" | "nextCursor"> & {
  kind: CommerceReportKind; filters: CommerceReportFilters; details: CommerceReportDetails;
};
export const reportDate = (value: string | null) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
};
export const reportMoney = (value: number) => `PHP ${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function reportFilterLabels(filters: CommerceReportFilters) {
  const period = filters.dateRange === "custom" ? `${filters.from} to ${filters.to}` : ({ all: "All dates", today: "Today", last_7_days: "Last 7 days", last_30_days: "Last 30 days" }[filters.dateRange] ?? filters.dateRange);
  return [period, `Order: ${reportLabel(filters.status)}`, `Payment: ${reportLabel(filters.paymentStatus)}`, `Method: ${reportLabel(filters.paymentMethod)}`, `Data: ${reportLabel(filters.scope)}`,
    ...(filters.view !== "all" ? [`Queue: ${reportLabel(filters.view)}`] : []), ...(filters.query.trim() ? [`Search: ${filters.query.trim()}`] : [])];
}
export function reportFilterError(filters: CommerceReportFilters) {
  if (filters.dateRange === "custom" && (!/^\d{4}-\d{2}-\d{2}$/.test(filters.from) || !/^\d{4}-\d{2}-\d{2}$/.test(filters.to) || filters.from > filters.to)) return "Choose a valid start and end date.";
  if (filters.query.length > 150) return "Keep the search to 150 characters or fewer.";
  return "";
}
export function commerceReportCsv(report: CommerceReport) {
  const header = ["Order", "Placed (Asia/Manila)", "Customer", "Order status", "Payment method", "Payment status", "Data environment", "Subtotal (PHP)", "Delivery (PHP)", "Discount (PHP)", "Total (PHP)", "Payment reference", "Provider paid at (Asia/Manila)",
    ...(report.details.contact ? ["Email", "Mobile"] : []), ...(report.details.address ? ["Delivery address"] : []), ...(report.details.items && report.kind === "orders" ? ["Products (quantity x unit price PHP)"] : [])];
  return "\uFEFF" + reportCsv([header, ...report.rows.map(row => [row.order_number, reportDate(row.created_at), row.shipping_address.name, reportLabel(row.status), reportLabel(row.payment_method), reportLabel(row.payment_status), reportEnvironmentLabel(row.environment), Number(row.subtotal), Number(row.delivery_fee), Number(row.discount), Number(row.total), row.payment_reference, reportDate(row.paid_at),
    ...(report.details.contact ? [row.email ?? "", row.mobile ?? ""] : []), ...(report.details.address ? [row.address ?? ""] : []), ...(report.details.items && report.kind === "orders" ? [(row.items ?? []).map(i => `${i.name} (${i.quantity} x ${Number(i.unit_price).toFixed(2)})`).join("; ")] : [])])]);
}
export const commerceReportFilename = (report: CommerceReport, format: "csv" | "pdf") => {
  const generated = new Date(report.asOf);
  const date = generated.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const time = generated.toLocaleTimeString("en-GB", { timeZone: "Asia/Manila", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/:/g, "");
  return `CozyCraft-${report.kind}-${report.filters.status}-${report.filters.paymentStatus}-${report.filters.paymentMethod}-${date}${format === "pdf" ? `-${time}-list-v2` : ""}.${format}`;
};
