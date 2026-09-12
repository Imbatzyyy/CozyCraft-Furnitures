import { conversationQuery, peso, type AssistantAction, type CatalogEntry, type ConversationMessage, type HelpGuide } from "./cozycraft-assistant-knowledge.ts";
type Row = Record<string, unknown>;
export type PublicSnapshot = { generatedAt: string; catalogAvailable: boolean; catalogComplete: boolean; settingsAvailable: boolean; settings: Row | null; products: CatalogEntry[]; pages: Array<{ slug: string; title: string; summary: string; body: string }> };
export type CustomerSnapshot = { authenticated: boolean; ordersAvailable?: boolean; ordersAreLimited?: boolean; requestedOrder?: string; orders?: Row[]; loyaltyAvailable?: boolean; loyalty?: Row | null; vouchersAvailable?: boolean; vouchers?: Row[]; ticketsAvailable?: boolean; tickets?: Row[]; returnsAvailable?: boolean; returns?: Row[] };
const record = (value: unknown): Row => value && typeof value === "object" ? value as Row : {};
const numeric = (value: unknown) => value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
export const recordedTime = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) + " PHT" : "time not recorded";
const status = (value: unknown) => typeof value === "string" && value ? value.replace(/_/g, " ") : "not recorded";

export function buildGroundedAnswer({ message, history, knowledge, customer, products, guides }: { message: string; history: ConversationMessage[]; knowledge: PublicSnapshot; customer: CustomerSnapshot; products: CatalogEntry[]; guides: HelpGuide[] }) {
  const query = conversationQuery(message, history);
  const localLanguage = /\b(po|paano|bakit|saan|magkano|ako|aking|nabawasan|bayad|nasaan|sukat)\b/i.test(message);
  const sections: string[] = [], sources: string[] = ["Website help"];
  const actions: AssistantAction[] = guides.map(guide => guide.action);
  const guide = guides[0];
  const personalOrder = /\bCC[- ]?\d{3,12}\b|\b(?:my|latest|recent|current|aking)\b.*\borders?\b|\b(track|nasaan)\b|\border.*status\b/i.test(query) && !/\bhow (?:do|can|to)|paano/i.test(message);
  const troubleshooting = /\b(why|not|can't|cannot|won't|failed|error|issue|wrong|damaged|stuck|missing|still|bakit|hindi|nabawasan|sira|basag)\b/i.test(message);
  const multiPart = /\b(?:and|also|then|at saka)\b/i.test(message);
  let direct = false;
  if (personalOrder) {
    sources.push("Your account records");
    actions.unshift({ label: "Open my orders", href: "/profile?tab=orders" });
    if (!customer.authenticated) {
      sections.push("Please sign in to your customer account before I check private order records. Once signed in, send the order number or ask for your latest order. You can also open My Account, then Orders and Full tracking.");
      actions.unshift({ label: "Customer sign in", href: "/login" });
    } else if (customer.ordersAvailable !== true) {
      sections.push("I couldn’t retrieve your order records safely just now. That does not mean your orders are missing. Open My Account, then Orders, and try again. If it also fails there, contact Support.");
    } else if (!customer.orders?.length) {
      sections.push(customer.requestedOrder ? `I could not find ${customer.requestedOrder} in this signed-in account. Please check the number and the account used at checkout. I cannot access another customer's order.` : "No orders were returned for this signed-in account. Check that this is the account used at checkout, or ask Support to investigate.");
    } else {
      const requestedStatus = message.match(/\b(pending|processing|packed|shipped|delivered|cancelled|canceled)\b/i)?.[1]?.toLowerCase().replace("canceled", "cancelled");
      const matching = requestedStatus && !customer.requestedOrder ? customer.orders.filter(order => order.status === requestedStatus) : customer.orders;
      if (!matching.length) sections.push(`I did not find a ${requestedStatus} order in the recent records checked. This is not a complete search of older orders; open Orders and its filters for your full history.`);
      else {
        for (const order of matching.slice(0, requestedStatus ? 3 : 1)) {
          sections.push(`${String(order.order_number)}\nDelivery status: ${status(order.status)}.\nPayment status: ${status(order.payment_status)}.\nTotal: ${peso(numeric(order.total))}.\nPlaced: ${recordedTime(order.created_at)}.`);
          if (order.refund_status && order.refund_status !== "none") sections.push(`Refund status: ${status(order.refund_status)}${order.refunded_at ? `. Recorded refund time: ${recordedTime(order.refunded_at)}` : ""}.`);
          const timeline = Array.isArray(order.timeline) ? order.timeline as Row[] : [];
          if (timeline[0]) sections.push(`Latest recorded delivery event: ${status(timeline[0].status)}, ${recordedTime(timeline[0].changedAt)}.`);
        }
        sections.push("Open Orders, choose this order, and select Full tracking for the detailed dated timeline. A paid status does not mean the order has been delivered.");
      }
    }
    direct = !multiPart && !troubleshooting && !localLanguage;
  }

  if (/points|home circle|loyalty|tier|voucher|reward|convert|redeem/i.test(query)) {
    if (customer.authenticated) {
      sources.push("Your account records");
      if (customer.loyaltyAvailable && customer.loyalty) {
        const balance = numeric(customer.loyalty.points_balance);
        sections.push(`Your recorded Home Circle balance is ${balance === null ? "unavailable" : `${balance} points`}; tier: ${status(customer.loyalty.tier)}.`);
      } else sections.push("Your Home Circle balance could not be confirmed here. Open Home Circle and refresh before choosing an exchange; I won’t treat unavailable data as zero points.");
      if (/voucher|reward|redeem/i.test(query) && customer.vouchersAvailable === true) {
        const active = (customer.vouchers ?? []).filter(voucher => voucher.status === "available" && typeof voucher.expires_at === "string" && Date.parse(voucher.expires_at) > Date.now());
        if (active.length) sections.push(`Available vouchers checked (up to six):\n${active.slice(0, 3).map(voucher => `${peso(numeric(voucher.discount_amount))} off; minimum order ${peso(numeric(voucher.minimum_order_amount))}; expires ${recordedTime(voucher.expires_at)}.`).join("\n")}`);
        else sections.push("No currently available, unexpired vouchers were returned. Check Available rewards in Home Circle for your wallet.");
      }
    } else sections.push("Sign in to see your own Home Circle balance and available vouchers.");
  }

  if (customer.ticketsAvailable !== undefined) {
    if (!customer.ticketsAvailable) sections.push("I could not retrieve your ticket status. Please open Support; I won’t assume the ticket is missing.");
    else if (customer.tickets?.length) sections.push(`Recent tickets checked:\n${customer.tickets.map(ticket => `${ticket.ticket_number}: ${status(ticket.status)}. Created ${recordedTime(ticket.created_at)}.`).join("\n")}\nOpen Support to read staff replies.`);
    else sections.push("No recent tickets were returned for this account. Open Support to review or start a ticket.");
  }
  if (customer.returnsAvailable !== undefined) {
    if (!customer.returnsAvailable) sections.push("Your return-request records could not be loaded. Please open Orders to check the request; I won’t assume that a return is approved or missing.");
    else if (customer.returns?.length) sections.push(`Recent return requests checked:\n${customer.returns.map(item => `${item.return_number}: ${status(item.status)}. Updated ${recordedTime(item.updated_at)}.`).join("\n")}\nA return request status is separate from the order's refund status.`);
    else sections.push("No recent return requests were returned for this account. Open Orders to review the available return action.");
  }

  if (/delivery|shipping|fee|arrive|arrival/i.test(message) && !personalOrder) {
    const checkout = record(knowledge.settings?.checkout_settings), fulfillment = record(knowledge.settings?.fulfillment_settings);
    const fee = numeric(checkout.standard_delivery_fee), minimum = numeric(checkout.free_delivery_minimum);
    const minDays = numeric(fulfillment.estimated_delivery_days_min), maxDays = numeric(fulfillment.estimated_delivery_days_max);
    if (knowledge.settingsAvailable) {
      sources.push("Current store settings");
      if (fee !== null) sections.push(`The current standard delivery fee is ${peso(fee)}.${minimum !== null && minimum > 0 ? ` The free-delivery threshold is ${peso(minimum)} for the selected checkout subtotal.` : ""}`);
      if (minDays !== null && maxDays !== null) sections.push(`The general delivery estimate is ${minDays}–${maxDays} days, not a guaranteed arrival date. Review the address-specific checkout total before ordering.`);
    } else sections.push("I could not load current delivery settings. Please check the fee and estimate shown at checkout; I won’t quote an old or assumed amount.");
  }
  if (/cancel|return|refund/i.test(message) && knowledge.settingsAvailable) {
    const fulfillment = record(knowledge.settings?.fulfillment_settings);
    const hours = numeric(fulfillment.cancellation_window_hours), days = numeric(fulfillment.return_window_days);
    if (/cancel/i.test(message) && hours !== null) sections.push(`The configured cancellation request window is ${hours} hours. Order status still determines whether the action is available.`);
    if (/return|refund/i.test(message) && days !== null) sections.push(`The configured return request window is ${days} days. Review the order's available actions and the Refunds policy for conditions and statutory remedies.`);
    actions.push({ label: "Read the refunds policy", href: "/refunds" });
  }
  if (/payment method|ways to pay|which.*payment|accept.*(?:gcash|card|cod)/i.test(message)) {
    const checkout = record(knowledge.settings?.checkout_settings);
    const available = [["cod_enabled", "Cash on Delivery"], ["card_enabled", "card"], ["gcash_enabled", "GCash"]].filter(([key]) => checkout[key] === true).map(([, label]) => label);
    sections.push(knowledge.settingsAvailable ? `Currently enabled payment methods: ${available.join(", ") || "none confirmed"}. Review the available choices at checkout.` : "Current payment availability could not be loaded. Use the methods shown at checkout.");
  }
  if (guide && !personalOrder) {
    if (troubleshooting) sections.push("I’m sorry this is getting in your way. Here is the relevant path to check:");
    for (const item of guides.slice(0, multiPart ? 2 : 1)) sections.push(`${item.title}\n${item.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\n${item.note}`);
    // Only exact, simple navigation requests bypass generation. A broad keyword
    // such as "payment" no longer masks specific failures or follow-up questions.
    direct = !troubleshooting && !multiPart && !localLanguage && /^(?:how (?:do|can) i|how to|where (?:do|can) i|where is|steps to)/i.test(message);
  }
  if (!guide && !personalOrder) {
    if (/product|furniture|sofa|chair|table|bed|cabinet|material|dimension|size|recommend|compare|sukat|upuan|mesa|kama|\bunder\b/i.test(query) || products.some(product => query.toLowerCase().includes(product.name.toLowerCase()))) {
      sources.push("Current product catalog");
      if (!knowledge.catalogAvailable) sections.push("The live catalog could not be loaded. I can’t safely confirm a product's price, stock, or measurements. Open its product page and try again.");
      else if (!products.length) sections.push("I did not find a matching product within those preferences in the catalog records checked. I won’t substitute a different furniture type or an over-budget item. Would you like to adjust the budget or product type?");
      else sections.push(`Here are the closest catalog matches checked:\n${products.slice(0, 3).map((product, index) => `${index + 1}. ${product.name}: ${peso(product.price)}. ${product.stock === null ? "Stock not confirmed" : product.stock > 0 ? "In stock" : "Out of stock"}.${product.dimensions ? ` Recorded size: ${product.dimensions}.` : " Measurements not recorded; ask Support before ordering."}${product.material ? ` Material: ${product.material}.` : ""}`).join("\n\n")}\n\nOpen a product below to inspect its photos and specifications. Final availability is checked during checkout.`);
    } else sections.push("I can guide you through CozyCraft. Which specific screen or task do you need help with? For example, describe the checkout step, share a product name, or give an order number. Please leave out passwords, verification codes and payment credentials.");
  }
  return { reply: sections.join("\n\n"), direct, actions, sources: [...new Set(sources)] };
}
