import { jsPDF } from "jspdf";
import { reportDate, reportEnvironmentLabel, reportFilterLabels, reportLabel, reportMoney, type CommerceReport } from "./commerce-report";

const C = { ink: [36, 36, 31], olive: [68, 85, 59], muted: [99, 97, 90], line: [225, 222, 214], cream: [248, 247, 243], white: [255, 255, 255], green: [48, 83, 54], amber: [117, 78, 28], red: [143, 56, 46] } as const;
const clean = (value: unknown) => String(value ?? "").replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, " ").replace(/\s+/g, " ").trim();
const W = 297, M = 14, BOTTOM = 190;
// Keep room for the full 5,000-record export limit in the numbered column.
const widths = [14, 28, 35, 52, 32, 35, 31, 42];
const BODY_SIZE = 8.5, BODY_LEADING = 4.2, DETAIL_SIZE = 7.5, DETAIL_LEADING = 3.8;

/** Landscape A4, with complete wrapped rows and repeating headings/footers. */
export function createCommerceReportPdf(report: CommerceReport, logoDataUrl?: string | null): ArrayBuffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const title = report.kind === "orders" ? "Orders report" : "Payments report";
  doc.setProperties({ title: `CozyCraft ${title}`, subject: reportFilterLabels(report.filters).join(" | "), author: "CozyCraft Furnitures", creator: "CozyCraft administration" });
  let y = 0;
  let pageBodyTop = 0;
  const textColor = (c: readonly [number, number, number]) => doc.setTextColor(...c);
  const fill = (c: readonly [number, number, number]) => doc.setFillColor(...c);
  const line = () => doc.setDrawColor(...C.line);
  const tableHead = () => {
    fill(C.olive); doc.rect(M, y, W - M * 2, 9, "F");
    textColor(C.white); doc.setFont("helvetica", "bold"); doc.setFontSize(7.3);
    let x = M;
    ["NO.", "ORDER", "PLACED / MANILA", "CUSTOMER", "ORDER STATUS", "PAYMENT METHOD", "PAYMENT STATUS", "TOTAL / PHP"].forEach((label, i) => {
      doc.text(label, i === 7 ? x + widths[i] - 3 : x + 3, y + 5.7, { align: i === 7 ? "right" : "left" }); x += widths[i];
    });
    y += 9;
    pageBodyTop = y;
  };
  const header = (first: boolean) => {
    // A small, print-friendly identity block leaves the page for the list.
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", M, 10, 30, 12, "cozycraft-logo", "FAST");
    else { textColor(C.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("COZYCRAFT", M, 16); doc.setFontSize(6); doc.text("F U R N I T U R E S", M, 21); }
    line(); doc.line(49, 10, 49, 23);
    textColor(C.olive); doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.text("ADMINISTRATION / RECORD LIST", 54, 12);
    textColor(C.ink); doc.setFont("times", "bold"); doc.setFontSize(20); doc.text(title, 54, 22);
    textColor(C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(`Generated ${clean(reportDate(report.asOf))} (UTC+08)`, W - M, 13, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.text(`${report.total.toLocaleString("en-PH")} ${report.total === 1 ? "record" : "records"} | Newest first`, W - M, 20, { align: "right" });
    line(); doc.line(M, 27, W - M, 27);
    y = 33;
    if (first) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      const labels = doc.splitTextToSize(clean(reportFilterLabels(report.filters).join("  |  ")), W - M * 2 - 8) as string[];
      doc.text(labels, M, y, { lineHeightFactor: 1.4 }); y += labels.length * 3.8 + 3;
    } else {
      doc.setFont("helvetica", "normal"); doc.text("Continued record list | Filters shown on page 1", M, y); y += 6;
    }
    tableHead();
  };
  const newPage = () => { doc.addPage(); header(false); };
  const detailLines = (value: string) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(DETAIL_SIZE);
    return doc.splitTextToSize(clean(value), W - M * 2 - 18) as string[];
  };
  const continuation = (orderNumber: string) => {
    fill(C.cream); doc.rect(M, y, W - M * 2, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); textColor(C.olive);
    doc.text(clean(`Order ${orderNumber} - details continued`), M + 3, y + 4.6); y += 7;
  };
  const detailBlock = (value: string, orderNumber: string) => {
    const lines = detailLines(value);
    let offset = 0;
    while (offset < lines.length) {
      if (y + DETAIL_LEADING + 2 > BOTTOM) { newPage(); continuation(orderNumber); }
      const count = Math.max(1, Math.floor((BOTTOM - y - 2) / DETAIL_LEADING));
      const segment = lines.slice(offset, offset + count);
      fill(C.cream); doc.rect(M, y, W - M * 2, segment.length * DETAIL_LEADING + 2, "F");
      textColor(C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(DETAIL_SIZE); doc.text(segment, M + 13, y + 3.5, { lineHeightFactor: 1.4 });
      y += segment.length * DETAIL_LEADING + 2; offset += segment.length;
    }
  };
  header(true);
  if (!report.rows.length) { y += 14; textColor(C.muted); doc.setFontSize(11); doc.text("No records match these filters.", M + 4, y); }
  report.rows.forEach((row, index) => {
    const details = [
      `Data: ${reportEnvironmentLabel(row.environment)} | Subtotal ${reportMoney(row.subtotal)} | Delivery ${reportMoney(row.delivery_fee)} | Discount ${reportMoney(row.discount)}`,
      ...(report.kind === "payments" ? [`Reference: ${row.payment_reference} | Provider paid at: ${reportDate(row.paid_at)}`] : []),
      ...(report.details.contact ? [`Contact: ${row.email || "Not recorded"} | ${row.mobile || "Not recorded"}`] : []),
      ...(report.details.address ? [`Delivery: ${row.address || "Not recorded"}`] : []),
      ...(report.details.items && report.kind === "orders" ? (row.items ?? []).map(item => `Product: ${item.name} | Qty ${item.quantity} | Unit ${reportMoney(item.unit_price)} | Line ${reportMoney(item.quantity * item.unit_price)}`) : []),
    ];
    const detailsHeight = details.reduce((height, value) => height + detailLines(value).length * DETAIL_LEADING + 2, 0);
    doc.setFontSize(BODY_SIZE);
    const cells = [String(index + 1), row.order_number, reportDate(row.created_at), row.shipping_address.name, reportLabel(row.status), reportLabel(row.payment_method), reportLabel(row.payment_status), Number(row.total).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })];
    const lines = cells.map((cell, i) => {
      doc.setFont("helvetica", i === 1 || i === 7 ? "bold" : "normal");
      return doc.splitTextToSize(clean(cell), widths[i] - 6) as string[];
    });
    const totalLines = Math.max(...lines.map(cell => cell.length));
    const rowHeight = totalLines * BODY_LEADING + 7 + detailsHeight;
    // Keep a normal order and all its details together. Very large product
    // lists still flow across pages without discarding any content.
    if (y + rowHeight > BOTTOM && rowHeight <= BOTTOM - pageBodyTop && y > pageBodyTop) newPage();
    let offset = 0;
    while (offset < totalLines) {
      if (y + 10 > BOTTOM) newPage();
      const count = Math.min(totalLines - offset, Math.max(1, Math.floor((BOTTOM - y - 5) / BODY_LEADING)));
      const height = count * BODY_LEADING + 5;
      fill(index % 2 ? [251, 250, 247] : C.white); doc.rect(M, y, W - M * 2, height, "F");
      let x = M; doc.setFontSize(BODY_SIZE);
      lines.forEach((cell, i) => {
        doc.setFont("helvetica", i === 1 || i === 7 ? "bold" : "normal");
        const status = i === 4 ? row.status : i === 6 ? row.payment_status : "";
        textColor(["paid", "delivered"].includes(status) ? C.green : ["failed", "cancelled"].includes(status) ? C.red : ["pending", "processing"].includes(status) ? C.amber : i === 0 ? C.muted : C.ink);
        const segment = cell.slice(offset, offset + count);
        if (segment.length) doc.text(segment, i === 7 ? x + widths[i] - 3 : x + 3, y + 5, { align: i === 7 ? "right" : "left", lineHeightFactor: 1.4 });
        x += widths[i];
      });
      y += height; offset += count;
    }
    details.forEach(value => detailBlock(value, row.order_number));
    line(); doc.line(M, y, W - M, y); y += 2;
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); line(); doc.line(M, 194, W - M, 194); textColor(C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text("COZYCRAFT FURNITURES | Confidential - authorized use only", M, 199);
    doc.text("One record per order | PHP | Asia/Manila", W / 2 + 15, 199, { align: "center" });
    doc.text(`Page ${page} of ${pages}`, W - M, 199, { align: "right" });
  }
  return doc.output("arraybuffer");
}

let logoPromise: Promise<string | null> | undefined;
export async function commerceReportPdfBlob(report: CommerceReport) {
  logoPromise ??= (async () => {
    try {
      const response = await fetch("/email-logo.png", { cache: "force-cache", signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string | null>(resolve => {
        const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null); reader.onerror = () => resolve(null); reader.readAsDataURL(blob);
      });
    } catch { return null; }
  })();
  return new Blob([createCommerceReportPdf(report, await logoPromise)], { type: "application/pdf" });
}
