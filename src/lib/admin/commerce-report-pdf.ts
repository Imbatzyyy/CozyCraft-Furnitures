import { jsPDF } from "jspdf";
import { reportDate, reportEnvironmentLabel, reportFilterLabels, reportLabel, reportMoney, type CommerceReport } from "./commerce-report";

const C = { ink: [36, 36, 31], olive: [68, 85, 59], muted: [107, 104, 96], line: [222, 216, 205], cream: [247, 244, 237], white: [255, 255, 255] } as const;
const clean = (value: unknown) => String(value ?? "").replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, " ").replace(/\s+/g, " ").trim();
const W = 297, H = 210, M = 14, BOTTOM = 189;
const widths = [29, 38, 60, 32, 38, 32, 40];

/** Landscape A4, with complete wrapped rows and repeating headings/footers. */
export function createCommerceReportPdf(report: CommerceReport, logoDataUrl?: string | null): ArrayBuffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const title = report.kind === "orders" ? "Orders report" : "Payments report";
  doc.setProperties({ title: `CozyCraft ${title}`, subject: reportFilterLabels(report.filters).join(" | "), author: "CozyCraft Furnitures", creator: "CozyCraft administration" });
  let y = 0;
  const textColor = (c: readonly [number, number, number]) => doc.setTextColor(...c);
  const fill = (c: readonly [number, number, number]) => doc.setFillColor(...c);
  const line = () => doc.setDrawColor(...C.line);
  const tableHead = () => {
    fill(C.olive); doc.rect(M, y, W - M * 2, 9, "F");
    textColor(C.white); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    let x = M;
    ["ORDER", "PLACED / MANILA", "CUSTOMER", "FULFILLMENT", "PAYMENT METHOD", "PAYMENT", "TOTAL / PHP"].forEach((label, i) => {
      doc.text(label, i === 6 ? x + widths[i] - 3 : x + 3, y + 5.7, { align: i === 6 ? "right" : "left" }); x += widths[i];
    });
    y += 9;
  };
  const header = (first: boolean) => {
    fill(C.cream); doc.rect(0, 0, W, H, "F");
    fill(C.white); doc.roundedRect(M, 8, 43, 19, 2, 2, "F");
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", M + 4, 10.5, 35, 14, "cozycraft-logo", "FAST");
    else { textColor(C.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("COZYCRAFT", M + 4, 17); doc.setFontSize(6.5); doc.text("F U R N I T U R E S", M + 4, 22); }
    textColor(C.olive); doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text("COZYCRAFT / ADMINISTRATION", 64, 13);
    textColor(C.ink); doc.setFont("times", "bold"); doc.setFontSize(first ? 24 : 19); doc.text(title, 64, first ? 24 : 23);
    textColor(C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Generated ${clean(reportDate(report.asOf))} (UTC+08)`, W - M, 14, { align: "right" });
    doc.text(`${report.total.toLocaleString()} matching ${report.kind} | Newest first`, W - M, 21, { align: "right" });
    line(); doc.line(M, 31, W - M, 31);
    y = 38;
    if (first) {
      const labels = doc.splitTextToSize(clean(reportFilterLabels(report.filters).join("  |  ")), W - M * 2 - 8) as string[];
      doc.setFontSize(8); doc.text(labels, M + 1, y); y += labels.length * 4 + 5;
      const cards = [
        ["TOTAL ORDER VALUE", report.summary.totalValue], ["SETTLED SALES", report.summary.settledValue],
        ["PENDING COLLECTION", report.summary.pendingValue], ["REFUNDED VALUE", report.summary.refundedValue],
      ] as const;
      const cw = (W - M * 2 - 9) / 4;
      cards.forEach(([label, value], i) => {
        const x = M + i * (cw + 3); fill(i === 1 ? C.olive : C.white); doc.roundedRect(x, y, cw, 22, 2, 2, "F");
        textColor(i === 1 ? C.white : C.muted); doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.text(label, x + 4, y + 6);
        textColor(i === 1 ? C.white : C.ink); doc.setFont("times", "bold"); doc.setFontSize(14); doc.text(reportMoney(Number(value)), x + 4, y + 15);
      });
      y += 28; textColor(C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7.2);
      doc.text("Settled sales: paid, non-cancelled orders in the selected data scope. Pending orders are not revenue.", M, y);
      y += 4; doc.text("One record per order. Payment references identify the latest settled record or latest attempt. Dates use Asia/Manila.", M, y);
      y += 7;
    }
    tableHead();
  };
  const newPage = () => { doc.addPage(); header(false); };
  const detailBlock = (value: string) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(clean(value), W - M * 2 - 8) as string[];
    let offset = 0;
    while (offset < lines.length) {
      if (y + 6 > BOTTOM) newPage();
      const count = Math.max(1, Math.floor((BOTTOM - y - 3) / 3.7));
      const segment = lines.slice(offset, offset + count);
      fill(C.white); doc.rect(M, y, W - M * 2, segment.length * 3.7 + 3, "F");
      textColor(C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(segment, M + 4, y + 3.5, { lineHeightFactor: 1.4 });
      y += segment.length * 3.7 + 3; offset += segment.length;
    }
  };
  header(true);
  if (!report.rows.length) { y += 14; textColor(C.muted); doc.setFontSize(11); doc.text("No records match these filters.", M + 4, y); }
  report.rows.forEach((row, index) => {
    const details = [
      `#${row.order_number} | Data: ${reportEnvironmentLabel(row.environment)} | Subtotal ${reportMoney(row.subtotal)} | Delivery ${reportMoney(row.delivery_fee)} | Discount ${reportMoney(row.discount)}`,
      ...(report.kind === "payments" ? [`Reference: ${row.payment_reference} | Provider paid at: ${reportDate(row.paid_at)}`] : []),
      ...(report.details.contact ? [`Contact: ${row.email || "Not recorded"} | ${row.mobile || "Not recorded"}`] : []),
      ...(report.details.address ? [`Delivery: ${row.address || "Not recorded"}`] : []),
      ...(report.details.items && report.kind === "orders" ? (row.items ?? []).map(item => `Product: ${item.name} | Qty ${item.quantity} | Unit ${reportMoney(item.unit_price)} | Line ${reportMoney(item.quantity * item.unit_price)}`) : []),
    ];
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    const detailsHeight = details.reduce((height, value) => height + (doc.splitTextToSize(clean(value), W - M * 2 - 8) as string[]).length * 3.7 + 3, 0);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.2);
    const cells = [row.order_number, reportDate(row.created_at), row.shipping_address.name, reportLabel(row.status), reportLabel(row.payment_method), reportLabel(row.payment_status), Number(row.total).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })];
    const lines = cells.map((cell, i) => doc.splitTextToSize(clean(cell), widths[i] - 6) as string[]);
    const totalLines = Math.max(...lines.map(cell => cell.length));
    const rowHeight = totalLines * 4.1 + 7 + detailsHeight;
    // Keep a normal order and all its details together. Very large product
    // lists still flow across pages without discarding any content.
    if (y + rowHeight > BOTTOM && rowHeight < BOTTOM - 47) newPage();
    let offset = 0;
    while (offset < totalLines) {
      if (y + 10 > BOTTOM) newPage();
      const count = Math.min(totalLines - offset, Math.max(1, Math.floor((BOTTOM - y - 5) / 4.1)));
      const height = count * 4.1 + 5;
      fill(index % 2 ? [241, 238, 230] : C.white); doc.rect(M, y, W - M * 2, height, "F");
      let x = M; textColor(C.ink); doc.setFontSize(8.2);
      lines.forEach((cell, i) => {
        doc.setFont("helvetica", i === 0 || i === 6 ? "bold" : "normal");
        const segment = cell.slice(offset, offset + count);
        if (segment.length) doc.text(segment, i === 6 ? x + widths[i] - 3 : x + 3, y + 5, { align: i === 6 ? "right" : "left", lineHeightFactor: 1.4 });
        x += widths[i];
      });
      y += height; offset += count;
    }
    details.forEach(detailBlock);
    line(); doc.line(M, y, W - M, y); y += 2;
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); line(); doc.line(M, 194, W - M, 194); textColor(C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text("COZYCRAFT FURNITURES | Internal report - handle customer information with care", M, 199);
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
