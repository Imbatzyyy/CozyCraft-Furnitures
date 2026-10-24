import { describe, expect, it } from "vitest";
import { ALL_COMMERCE_FILTERS, BASIC_REPORT_DETAILS, commerceReportCsv, reportDate, reportFilterError, type CommerceReport } from "./commerce-report";
import { createCommerceReportPdf } from "./commerce-report-pdf";
// Inspect the actual compressed PDF content, rather than only its file header.
async function pdfContent(bytes: ArrayBuffer) {
  const source = Array.from(new Uint8Array(bytes), byte => String.fromCharCode(byte)).join("");
  // jsPDF emits LF delimiters. Treating an optional CR as a delimiter can
  // accidentally strip a valid final compressed byte from the stream.
  const streams = await Promise.all([...source.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(async match => {
    try {
      const data = Uint8Array.from(match[1], character => character.charCodeAt(0));
      return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"))).text();
    }
    catch { return match[1]; }
  }));
  return streams.join("\n");
}
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
  it("creates complete multipage PDFs with page numbering", async () => {
    const bytes = createCommerceReportPdf({ ...report, rows: Array.from({ length: 80 }, (_, i) => ({ ...report.rows[0], id: String(i), order_number: `CC-${i}`, shipping_address: { name: "A customer with a long recipient name for wrapping" } })), total: 80 });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-"); expect(bytes.byteLength).toBeGreaterThan(8000);
    const content = await pdfContent(bytes);
    for (let i = 0; i < 80; i++) expect(content.includes(`(CC-${i})`), `PDF retains record CC-${i}`).toBe(true);
    expect(content).toContain("(Page 1 of ");
    expect(content.match(/\(PAYMENT STATUS\)/g)?.length).toBeGreaterThan(1);
    expect(content).toContain("(NO.)");
  });
  it.each(["orders", "payments"] as const)("keeps %s list exports free of aggregate cards", async kind => {
    const content = await pdfContent(createCommerceReportPdf({ ...report, kind }));
    for (const label of ["TOTAL ORDER VALUE", "SETTLED SALES", "PENDING COLLECTION", "REFUNDED VALUE", "Pending orders are not revenue"])
      expect(content).not.toContain(label);
    expect(content).toContain("(CC-1)");
    expect(content).toContain("(1,100.00)");
    expect(content).toContain("(ORDER STATUS)");
    expect(content).toContain("Data: Cash on delivery");
    expect(content).toContain("All dates");
    expect(content).toContain("UTC+08");
    expect(content).not.toContain("private@example.test");
  });
  it("retains optional details across pages with order continuation labels", async () => {
    const content = await pdfContent(createCommerceReportPdf({ ...report, details: { contact: true, address: true, items: true }, rows: [{ ...report.rows[0], address: "Delivery address example", items: Array.from({length: 85}, (_, i) => ({name: `Product detail ${i} with a long descriptive furniture name`, quantity: 1, unit_price: 1000})) }] }));
    expect(content).toContain("private@example.test");
    expect(content).toContain("Delivery address example");
    expect(content).toContain("Order CC-1 - details continued");
    for (let i = 0; i < 85; i++) expect(content).toContain(`Product detail ${i} with`);
  });
  it("renders an empty filtered report without an empty summary section", async () => {
    const content = await pdfContent(createCommerceReportPdf({ ...report, rows: [], total: 0 }));
    expect(content).toContain("No records match these filters.");
    expect(content).toContain("Page 1 of 1");
  });
});
