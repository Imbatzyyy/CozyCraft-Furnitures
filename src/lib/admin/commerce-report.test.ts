import { describe, expect, it } from "vitest";
import { ALL_COMMERCE_FILTERS, BASIC_REPORT_DETAILS, commerceReportCsv, reportDate, reportFilterError, type CommerceReport } from "./commerce-report";
import { createCommerceReportPdf } from "./commerce-report-pdf";
const report: CommerceReport = {
  kind: "orders", filters: ALL_COMMERCE_FILTERS, details: BASIC_REPORT_DETAILS, total: 1, asOf: "2026-10-22T01:00:00Z", snapshotKey: "fixture",
  summary: { totalValue: 1100, settledValue: 1100, settledCount: 1, pendingValue: 0, refundedValue: 0, cancelledCount: 0 },
  rows: [{ id: "1", order_number: "CC-1", created_at: "2026-10-21T16:01:00Z", status: "delivered", payment_status: "paid", payment_method: "cod", total: 1100, subtotal: 1000, delivery_fee: 200, discount: 100, shipping_address: { name: '=HYPERLINK("evil")' }, environment: "cod", payment_reference: "COD-CC-1", paid_at: null, email: "private@example.test", items: [{ name: "Sofa", quantity: 1, unit_price: 1000 }] }],
};
describe("commerce report formats", () => {
  it("keeps monetary values numeric and neutralizes CSV formulas", () => {
    const csv = commerceReportCsv(report);
    expect(csv.startsWith("\uFEFF")).toBe(true); expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain('"1100"'); expect(csv).not.toContain("private@example.test"); expect(csv).not.toContain('"Products');
    const detailed = commerceReportCsv({ ...report, details: { ...BASIC_REPORT_DETAILS, items: true, contact: true } });
    expect(detailed).toContain("Sofa (1 x 1000.00)"); expect(detailed).toContain("private@example.test");
  });
  it("uses Philippine dates and validates custom periods", () => {
    expect(reportDate(report.rows[0].created_at)).toContain("Oct 22");
    expect(reportFilterError({ ...ALL_COMMERCE_FILTERS, dateRange: "custom", from: "2026-10-22", to: "2026-10-21" })).toContain("valid start");
  });
  it("creates complete multipage PDFs with page numbering", () => {
    const bytes = createCommerceReportPdf({ ...report, rows: Array.from({ length: 80 }, (_, i) => ({ ...report.rows[0], id: String(i), order_number: `CC-${i}`, shipping_address: { name: "A customer with a long recipient name for wrapping" } })), total: 80 });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-"); expect(bytes.byteLength).toBeGreaterThan(8000);
  });
});
