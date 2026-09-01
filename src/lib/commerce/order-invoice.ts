import { jsPDF } from "jspdf";
import type {
  DbBillingProfile,
  DbOrder,
} from "@/services/supabase/client";
import type { PublicStoreSettings } from "@/lib/settings/store-settings";
import {
  effectiveOrderPaymentStatus,
  orderPaymentMethodLabel,
  orderPaymentReference,
} from "@/lib/commerce/order-payment";

export type OrderInvoiceInput = {
  order: DbOrder;
  billing: DbBillingProfile;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  store: PublicStoreSettings;
  generatedAt?: Date;
  brandLogoDataUrl?: string | null;
};

export type OrderInvoiceBreakdown = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  discountLabel: string;
  adjustment: number;
  total: number;
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = 270;
const BRAND_LOGO_PATH = "/email-logo.png";

let brandLogoDataUrlPromise: Promise<string | null> | null = null;

const color = {
  ink: [31, 29, 26] as const,
  muted: [111, 106, 98] as const,
  paper: [249, 247, 243] as const,
  card: [255, 255, 255] as const,
  line: [220, 214, 204] as const,
  green: [78, 104, 72] as const,
  greenSoft: [226, 237, 221] as const,
};

const asAmount = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export function orderInvoiceBreakdown(order: DbOrder): OrderInvoiceBreakdown {
  const subtotal = asAmount(order.subtotal);
  const deliveryFee = asAmount(order.delivery_fee);
  const total = asAmount(order.total);
  const explicitDiscount = Math.max(0, asAmount(order.reward_discount));
  const inferredDiscount = Math.max(0, subtotal + deliveryFee - total);
  const discount = explicitDiscount || inferredDiscount;
  const adjustment = total - (subtotal + deliveryFee - discount);
  return {
    subtotal,
    deliveryFee,
    discount,
    discountLabel: explicitDiscount > 0 ? "Home Circle reward" : "Order discount",
    adjustment: Math.abs(adjustment) >= 0.01 ? adjustment : 0,
    total,
  };
}

const pdfText = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatMoney = (value: number, currency: string) =>
  `${pdfText(currency || "PHP")} ${new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "Not recorded";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const titleCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const joinAddress = (parts: unknown[]) =>
  parts.map(pdfText).filter(Boolean).join(", ");

const deliveredAt = (order: DbOrder) =>
  order.order_status_history
    ?.filter((entry) => entry.status === "delivered")
    .sort(
      (left, right) =>
        Date.parse(right.changed_at) - Date.parse(left.changed_at),
    )[0]?.changed_at ?? null;

const invoiceNumber = (order: DbOrder) => `INV-${pdfText(order.order_number)}`;

const invoiceFileName = (order: DbOrder) =>
  `CozyCraft-Invoice-${pdfText(order.order_number).replace(/[^A-Za-z0-9-]/g, "-")}.pdf`;

const setTextColor = (
  document: jsPDF,
  value: readonly [number, number, number],
) => document.setTextColor(value[0], value[1], value[2]);

const setFillColor = (
  document: jsPDF,
  value: readonly [number, number, number],
) => document.setFillColor(value[0], value[1], value[2]);

const setDrawColor = (
  document: jsPDF,
  value: readonly [number, number, number],
) => document.setDrawColor(value[0], value[1], value[2]);

const writeWrapped = (
  document: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 4.6,
) => {
  const lines = document.splitTextToSize(pdfText(text), width) as string[];
  document.text(lines, x, y);
  return y + Math.max(1, lines.length) * lineHeight;
};

function paintPage(document: jsPDF) {
  setFillColor(document, color.paper);
  document.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The CozyCraft logo could not be read."));
    reader.onerror = () => reject(reader.error ?? new Error("The CozyCraft logo could not be read."));
    reader.readAsDataURL(blob);
  });

async function loadBrandLogoDataUrl() {
  if (typeof window === "undefined" || typeof FileReader === "undefined") {
    return null;
  }
  if (!brandLogoDataUrlPromise) {
    brandLogoDataUrlPromise = fetch(BRAND_LOGO_PATH, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Logo request failed with ${response.status}.`);
        return response.blob();
      })
      .then(blobToDataUrl)
      .catch(() => null);
  }
  return brandLogoDataUrlPromise;
}

function drawBrandLogo(
  document: jsPDF,
  logoDataUrl: string | null | undefined,
  compact = false,
) {
  if (logoDataUrl) {
    const panelX = MARGIN;
    const panelY = compact ? 5 : 7;
    const panelWidth = compact ? 38 : 49;
    const panelHeight = compact ? 17 : 22;
    setFillColor(document, [255, 255, 255]);
    document.roundedRect(panelX, panelY, panelWidth, panelHeight, compact ? 2 : 2.5, compact ? 2 : 2.5, "F");
    document.addImage(
      logoDataUrl,
      "PNG",
      panelX + (compact ? 3 : 3.5),
      panelY + (compact ? 2.4 : 2.8),
      panelWidth - (compact ? 6 : 7),
      panelHeight - (compact ? 4.8 : 5.6),
      undefined,
      "FAST",
    );
    return;
  }

  setTextColor(document, [255, 255, 255]);
  document.setFont("helvetica", "bold");
  document.setFontSize(compact ? 11 : 16);
  document.text(compact ? "COZYCRAFT FURNITURES" : "COZYCRAFT", MARGIN, compact ? 13 : 18);
  if (!compact) {
    document.setFont("helvetica", "normal");
    document.setFontSize(7.5);
    document.setCharSpace(1.1);
    document.text("FURNITURES", MARGIN, 24);
    document.setCharSpace(0);
  }
}

function drawPrimaryHeader(
  document: jsPDF,
  order: DbOrder,
  generatedAt: Date,
  logoDataUrl?: string | null,
) {
  setFillColor(document, color.ink);
  document.rect(0, 0, PAGE_WIDTH, 45, "F");
  drawBrandLogo(document, logoDataUrl);

  setTextColor(document, [255, 255, 255]);
  document.setFontSize(7.5);
  document.setFont("helvetica", "bold");
  document.text("DIGITAL INVOICE / RECEIPT", PAGE_WIDTH - MARGIN, 14, {
    align: "right",
  });
  document.setFontSize(14);
  document.text(invoiceNumber(order), PAGE_WIDTH - MARGIN, 22, {
    align: "right",
  });
  document.setFontSize(7.5);
  document.setFont("helvetica", "normal");
  document.text(`Generated ${formatDate(generatedAt)}`, PAGE_WIDTH - MARGIN, 28, {
    align: "right",
  });

  setFillColor(document, color.greenSoft);
  document.roundedRect(PAGE_WIDTH - MARGIN - 31, 33, 31, 7, 3.5, 3.5, "F");
  setTextColor(document, color.green);
  document.setFont("helvetica", "bold");
  document.setFontSize(7.5);
  document.text("DELIVERED", PAGE_WIDTH - MARGIN - 15.5, 37.7, {
    align: "center",
  });
}

function drawContinuationHeader(
  document: jsPDF,
  order: DbOrder,
  logoDataUrl?: string | null,
) {
  setFillColor(document, color.ink);
  document.rect(0, 0, PAGE_WIDTH, 27, "F");
  drawBrandLogo(document, logoDataUrl, true);
  setTextColor(document, [255, 255, 255]);
  document.setFont("helvetica", "normal");
  document.setFontSize(8);
  document.text(`${invoiceNumber(order)} - continued`, PAGE_WIDTH - MARGIN, 13, {
    align: "right",
  });
}

function drawItemsHeader(document: jsPDF, y: number) {
  setFillColor(document, color.ink);
  document.roundedRect(MARGIN, y, CONTENT_WIDTH, 9, 2, 2, "F");
  setTextColor(document, [255, 255, 255]);
  document.setFont("helvetica", "bold");
  document.setFontSize(7.5);
  document.text("ITEM", MARGIN + 4, y + 5.8);
  document.text("QTY", 134, y + 5.8, { align: "center" });
  document.text("UNIT PRICE", 157, y + 5.8, { align: "right" });
  document.text("AMOUNT", PAGE_WIDTH - MARGIN - 4, y + 5.8, { align: "right" });
  return y + 9;
}

export function createOrderInvoiceDocument(input: OrderInvoiceInput) {
  if (input.order.status !== "delivered") {
    throw new Error("Digital invoice receipts are available after delivery.");
  }

  const { order, billing, customer, store } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  document.setProperties({
    title: `${invoiceNumber(order)} - ${store.store_name}`,
    subject: `Digital invoice receipt for order ${order.order_number}`,
    author: store.store_name,
    creator: "CozyCraft Furnitures customer website",
    keywords: "invoice, receipt, order, furniture",
  });
  document.setLanguage("en-PH");
  document.setLineHeightFactor(1.18);
  paintPage(document);
  drawPrimaryHeader(document, order, generatedAt, input.brandLogoDataUrl);

  const shipping = order.shipping_address ?? {};
  const shippingAddress = joinAddress([
    shipping.line,
    shipping.barangay,
    shipping.city,
    shipping.province,
    shipping.postal,
  ]);
  const billingAddress = billing.same_as_delivery || !billing.address_line
    ? shippingAddress
    : joinAddress([
        billing.address_line,
        billing.barangay,
        billing.city,
        billing.province,
        billing.postal_code,
      ]);
  const buyerName =
    pdfText(billing.recipient_name) ||
    pdfText(shipping.name) ||
    pdfText(customer.name) ||
    "CozyCraft customer";
  const buyerEmail = pdfText(billing.invoice_email) || pdfText(customer.email);

  const panelTop = 53;
  const panelWidth = (CONTENT_WIDTH - 5) / 2;
  setFillColor(document, color.card);
  setDrawColor(document, color.line);
  document.roundedRect(MARGIN, panelTop, panelWidth, 46, 3, 3, "FD");
  document.roundedRect(MARGIN + panelWidth + 5, panelTop, panelWidth, 46, 3, 3, "FD");

  setTextColor(document, color.muted);
  document.setFont("helvetica", "bold");
  document.setFontSize(7);
  document.setCharSpace(0.8);
  document.text("ISSUED BY", MARGIN + 5, panelTop + 7);
  document.text("BILL TO", MARGIN + panelWidth + 10, panelTop + 7);
  document.setCharSpace(0);

  setTextColor(document, color.ink);
  document.setFontSize(10);
  document.text(pdfText(store.store_name), MARGIN + 5, panelTop + 14);
  document.text(buyerName, MARGIN + panelWidth + 10, panelTop + 14);
  document.setFont("helvetica", "normal");
  document.setFontSize(7.2);
  setTextColor(document, color.muted);
  let sellerY = writeWrapped(
    document,
    store.business_address || store.delivery_area,
    MARGIN + 5,
    panelTop + 20,
    panelWidth - 10,
    4,
  );
  sellerY = writeWrapped(
    document,
    store.contact_email,
    MARGIN + 5,
    sellerY,
    panelWidth - 10,
    4,
  );
  if (store.support_phone) {
    writeWrapped(document, store.support_phone, MARGIN + 5, sellerY, panelWidth - 10, 4);
  }
  let buyerY = panelTop + 20;
  for (const detail of [
    billing.company_name,
    buyerEmail,
    billing.tax_id ? `Tax ID: ${billing.tax_id}` : "",
    billingAddress,
  ].filter(Boolean)) {
    buyerY = writeWrapped(
      document,
      detail,
      MARGIN + panelWidth + 10,
      buyerY,
      panelWidth - 10,
      4,
    );
  }

  let y = 106;
  setTextColor(document, color.ink);
  document.setFont("helvetica", "bold");
  document.setFontSize(9.5);
  document.text("Order summary", MARGIN, y);
  document.setFont("helvetica", "normal");
  document.setFontSize(7.5);
  setTextColor(document, color.muted);
  document.text(`Order #${pdfText(order.order_number)}`, PAGE_WIDTH - MARGIN, y, {
    align: "right",
  });
  y = drawItemsHeader(document, y + 4);

  const startContinuationPage = () => {
    document.addPage("a4", "portrait");
    paintPage(document);
    drawContinuationHeader(document, order, input.brandLogoDataUrl);
    y = drawItemsHeader(document, 34);
  };

  for (const [index, item] of order.order_items.entries()) {
    document.setFont("helvetica", "bold");
    document.setFontSize(8.5);
    const nameLines = document.splitTextToSize(pdfText(item.product_name), 94) as string[];
    const rowHeight = Math.max(15, 8 + nameLines.length * 4.2);
    if (y + rowHeight > CONTENT_BOTTOM) startContinuationPage();

    if (index % 2 === 1) {
      setFillColor(document, [246, 243, 238]);
      document.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "F");
    }
    setTextColor(document, color.ink);
    document.text(nameLines, MARGIN + 4, y + 6);
    document.setFont("helvetica", "normal");
    document.setFontSize(7);
    setTextColor(document, color.muted);
    document.text(`Item ${index + 1}`, MARGIN + 4, y + rowHeight - 3.5);
    document.setFontSize(8);
    setTextColor(document, color.ink);
    document.text(String(item.quantity), 134, y + 7, { align: "center" });
    document.text(formatMoney(asAmount(item.unit_price), store.currency_code), 157, y + 7, {
      align: "right",
    });
    document.setFont("helvetica", "bold");
    document.text(
      formatMoney(asAmount(item.unit_price) * item.quantity, store.currency_code),
      PAGE_WIDTH - MARGIN - 4,
      y + 7,
      { align: "right" },
    );
    setDrawColor(document, color.line);
    document.line(MARGIN, y + rowHeight, PAGE_WIDTH - MARGIN, y + rowHeight);
    y += rowHeight;
  }

  const breakdown = orderInvoiceBreakdown(order);
  if (y + 61 > CONTENT_BOTTOM) startContinuationPage();
  y += 7;

  const paymentStatus = effectiveOrderPaymentStatus(order);
  const paymentReference = orderPaymentReference(order);
  const deliveryTimestamp = deliveredAt(order);

  setFillColor(document, color.card);
  setDrawColor(document, color.line);
  document.roundedRect(MARGIN, y, 104, 54, 3, 3, "FD");
  document.roundedRect(125, y, 69, 54, 3, 3, "FD");

  setTextColor(document, color.muted);
  document.setFont("helvetica", "bold");
  document.setFontSize(7);
  document.setCharSpace(0.7);
  document.text("PAYMENT & DELIVERY", MARGIN + 5, y + 8);
  document.text("TOTALS", 130, y + 8);
  document.setCharSpace(0);

  document.setFont("helvetica", "normal");
  document.setFontSize(7.3);
  setTextColor(document, color.ink);
  const paymentLines = [
    `Payment: ${orderPaymentMethodLabel(order.payment_method)} - ${titleCase(paymentStatus)}`,
    `Reference: ${pdfText(paymentReference)}`,
    `Placed: ${formatDate(order.created_at)}`,
    `Delivered: ${formatDate(deliveryTimestamp)}`,
    `Deliver to: ${shippingAddress}`,
  ];
  let paymentY = y + 15;
  for (const line of paymentLines) {
    paymentY = writeWrapped(document, line, MARGIN + 5, paymentY, 94, 4.1);
  }

  const totalRows: Array<[string, number, boolean]> = [
    ["Subtotal", breakdown.subtotal, false],
    ["Delivery", breakdown.deliveryFee, false],
  ];
  if (breakdown.discount > 0) {
    totalRows.push([breakdown.discountLabel, -breakdown.discount, false]);
  }
  if (breakdown.adjustment !== 0) {
    totalRows.push(["Order adjustment", breakdown.adjustment, false]);
  }
  totalRows.push(["Total", breakdown.total, true]);

  let totalY = y + 16;
  for (const [label, amount, emphasis] of totalRows) {
    if (emphasis) {
      setDrawColor(document, color.line);
      document.line(130, totalY - 4, 189, totalY - 4);
      document.setFont("helvetica", "bold");
      document.setFontSize(9);
    } else {
      document.setFont("helvetica", "normal");
      document.setFontSize(7.3);
    }
    setTextColor(document, emphasis ? color.ink : color.muted);
    document.text(label, 130, totalY);
    document.text(formatMoney(amount, store.currency_code), 189, totalY, {
      align: "right",
    });
    totalY += emphasis ? 7 : 6;
  }

  const pages = document.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    document.setPage(page);
    setDrawColor(document, color.line);
    document.line(MARGIN, 279, PAGE_WIDTH - MARGIN, 279);
    document.setFont("helvetica", "normal");
    document.setFontSize(6.8);
    setTextColor(document, color.muted);
    document.text(
      `${pdfText(store.store_name)} - ${pdfText(store.contact_email)}`,
      MARGIN,
      285,
    );
    document.text(`Page ${page} of ${pages}`, PAGE_WIDTH - MARGIN, 285, {
      align: "right",
    });
  }

  return document;
}

export function createOrderInvoicePdf(input: OrderInvoiceInput) {
  return createOrderInvoiceDocument(input).output("arraybuffer");
}

export async function downloadOrderInvoicePdf(input: OrderInvoiceInput) {
  const brandLogoDataUrl = input.brandLogoDataUrl ?? await loadBrandLogoDataUrl();
  const document = createOrderInvoiceDocument({ ...input, brandLogoDataUrl });
  await document.save(invoiceFileName(input.order), { returnPromise: true });
}
