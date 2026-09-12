// Read-only website help. Keep destinations and button names aligned with the
// customer routes. This module contains no credentials and is also used by UI tests.
export type AssistantAction = { label: string; href: string };
export type ConversationMessage = { role: "user" | "assistant"; content: string };
export type HelpGuide = { id: string; title: string; match: RegExp; action: AssistantAction; steps: string[]; note: string };
const account = (tab: string, label: string): AssistantAction => ({ label, href: `/profile?tab=${tab}` });
export const HELP_GUIDES: HelpGuide[] = [
  { id: "tracking", title: "Follow an order", match: /\b(track\w*|where.*order|order.*status|shipment|nasaan|kailan.*order)\b/i, action: account("orders", "Open my orders"), steps: ["Open My Account, then Orders.", "Choose your order and select Full tracking.", "Read the recorded timeline, with dates and times, alongside payment and delivery details."], note: "A payment confirmation is not a delivery confirmation. No unrecorded delivery date or courier location is available to the assistant." },
  { id: "payment-issue", title: "Payment pending or interrupted", match: /(?:\b(paid|charged|deducted|payment|gcash|paymongo|card)\b.*\b(pending|failed|stuck|missing|error|twice|not|deducted)\b|\b(pending|failed|stuck|missing|error)\b.*\b(payment|gcash|card)\b|nabawasan|bayad na)/i, action: account("orders", "Check payment status"), steps: ["Open My Account, then Orders, and check the payment status of the same order.", "If PayMongo is still open, use its return-to-merchant option after completing payment.", "If your wallet was charged but the order is still unpaid, do not pay again. Start a support ticket with the order number and payment time."], note: "The verified payment record is authoritative. Never share your card number, wallet PIN, password, or OTP in chat. The assistant cannot confirm an unrecorded payment or promise a refund." },
  { id: "payment-otp", title: "Email code before online payment", match: /(?:\b(otp|code|verification|verify)\b.*\b(payment|checkout|gcash|card|paymongo|email)\b|\b(payment|checkout|gcash|paymongo)\b.*\b(otp|code|verify|verification)\b)/i, action: { label: "Open my bag", href: "/cart" }, steps: ["Select your items in My bag and proceed to checkout.", "Choose GCash or card. Check the account email shown in the verification dialog, including Spam or Junk.", "Enter the six-digit code in that dialog and select Verify and continue. Use Resend when its countdown finishes if needed."], note: "Enter the code only in the checkout dialog, not in chat. Verification alone does not charge you. Email delivery time is controlled in part by the mail provider; instant delivery cannot be guaranteed." },
  { id: "vouchers", title: "Convert points and use vouchers", match: /voucher|convert|redeem|redemption|exchange|reward|palit.*points/i, action: account("home-circle", "Open Home Circle"), steps: ["Open My Account, then Home Circle, and choose an affordable points-to-voucher option.", "Review the points cost and remaining balance in the confirmation dialog, then confirm only if you want to convert.", "Check Available rewards for the saved expiry and conditions. At checkout, select an eligible Home Circle voucher before confirming the total."], note: "Only available, unexpired vouchers that meet the order minimum can be applied. One voucher per order. A successful conversion queues a confirmation email; the wallet is the place to verify the claim if email is delayed." },
  { id: "loyalty", title: "Home Circle membership", match: /home circle|loyalty|points|tier|membership/i, action: account("home-circle", "View points and tier"), steps: ["Open My Account and select Home Circle.", "Review your current points, recorded eligible spending, tier progress, and recent activity.", "Use Refresh if a recent eligible change has not appeared yet."], note: "Use the recorded account balance, not an estimated earning or tier promise. Vouchers can also be viewed and claimed on this page." },
  { id: "phone", title: "Verify or replace a mobile number", match: /phone|mobile number|number.*verif|verif.*number|numero|smart|globe/i, action: account("profile", "Open phone settings"), steps: ["Open My Account, then Profile, and choose Edit profile.", "Enter a Philippine mobile number, or use Change number for an existing verified number.", "Complete the verification steps shown and enter the code sent to the new number before saving."], note: "A number already verified on another account cannot be reused. Do not remove your existing verified number just to troubleshoot delivery. For Smart or Globe delays, check the entered number, wait for the resend timer, and contact support if it continues. Never promise carrier delivery." },
  { id: "password", title: "Set or change a password", match: /password|forgot|reset|google.*sign|sign.*google/i, action: account("security", "Open account security"), steps: ["If signed in, open My Account and Change password.", "Choose Set up a password if your Google account has no CozyCraft password, or Change password if one is already set.", "Complete the security checks on that screen. If you cannot sign in, use Forgot password on the customer sign-in page."], note: "The assistant cannot change credentials or receive passwords and verification codes. Password recovery is also available at /forgot-password." },
  { id: "devices", title: "Review signed-in devices", match: /device|session|sign out|signed.in|log out|authenticator|two.step|2fa/i, action: account("security", "Review account security"), steps: ["Open My Account, then Change password.", "In Signed-in devices, use Refresh to load recent browser sessions and their recorded times.", "Sign out an individual other session, or use Sign out other devices. Your current browser is protected from that action."], note: "Authenticator setup and removal have their own verification steps on the same page. Device names are browser-reported, not exact physical-device identification." },
  { id: "addresses", title: "Manage delivery addresses", match: /address|recipient|postcode|postal|barangay|first.?name|last.?name|tirahan/i, action: account("addresses", "Manage addresses"), steps: ["Open My Account, then Addresses.", "Add or edit an address, including the recipient's first and last names and complete delivery details, then save.", "At checkout, select that saved address and check the recipient and location before placing the order."], note: "Editing a saved address does not rewrite an already placed order. For an existing order, contact support promptly; changes depend on dispatch status." },
  { id: "payment-preferences", title: "Set a preferred payment method", match: /payment preference|default.*(?:payment|gcash|card|cod)|preferred.*payment/i, action: account("payments", "Set payment preference"), steps: ["Open My Account, then Payments.", "Choose an available payment option and save it as your default preference.", "Check the preselected method next time you open checkout. You can choose another available method for that order."], note: "A store-disabled method cannot be used, even if previously saved. CozyCraft does not save card numbers or GCash credentials." },
  { id: "cancellation", title: "Request a cancellation", match: /cancel|cancellation|kansela/i, action: account("orders", "Review cancellation options"), steps: ["Open My Account, then Orders, and choose the relevant order.", "Use Request cancellation only if it is available, review the details, and confirm your request.", "Check cancellation and refund status separately. For a delivered product, review return options instead."], note: "Eligibility depends on order status and the configured window. A request is not an approval or a completed refund. The assistant never cancels orders." },
  { id: "returns", title: "Return, refund, or report damage", match: /return|refund|damaged|broken|wrong item|defect|sira|basag|ibalik/i, action: account("orders", "Open return options"), steps: ["Open My Account, then Orders, and select the affected order.", "For an eligible delivered order, select Request return, describe the issue, and attach clear product photos if requested.", "Follow the request status in your account. If the option is unavailable or a payment needs investigation, use Support with the order number."], note: "Do not promise approval, an exact refund date, or a warranty outcome. Read /refunds for the full policy; statutory remedies are not replaced by the website's request window." },
  { id: "receipts", title: "Download an order receipt", match: /receipt|invoice|resibo|download.*order/i, action: account("orders", "Find my receipt"), steps: ["Open My Account, then Orders.", "Select the delivered order and use its download receipt action.", "If it is not available, check the recorded order status or contact Support for help."], note: "The digital receipt uses recorded order charges. For additional invoice or tax documentation, ask customer care; the assistant cannot generate official tax documents." },
  { id: "reviews", title: "Write a product review", match: /review|rating|rate.*product/i, action: account("orders", "Review a delivered purchase"), steps: ["Open My Account, then Orders, and find a delivered product you purchased.", "Choose its review action, add an honest rating and review, and include a product photo if available.", "Submit once and check the product's reviews."], note: "Eligible reviews do not wait for staff approval. Content rules still apply. The assistant must not fabricate customer reviews or claim that a removed review was legitimate without evidence." },
  { id: "shopping", title: "Bag, saved items, and comparison", match: /cart|bag|wishlist|saved|favorite|favourite|compare/i, action: { label: "Open my bag", href: "/cart" }, steps: ["Open a product to check its photos, dimensions, current price, and availability.", "Use its save or bag action. In My bag, select only the items you want to buy; the others stay in your bag.", "Use Compare from the collection pages to compare saved comparison selections side by side."], note: "Sign in to save bag and wishlist items. Bag items are not reserved. Product availability is checked again during checkout." },
  { id: "delivery", title: "Delivery fees and timing", match: /delivery|shipping|fee|arrive|arrival|deliver|padala|magkano.*shipping/i, action: { label: "Review delivery at checkout", href: "/cart" }, steps: ["Select your products in My bag and proceed to checkout.", "Choose a saved address and check the calculated delivery fee and final total before confirming.", "After placing an order, use Orders and Full tracking for recorded delivery updates."], note: "General delivery estimates are not promised arrival dates. Only quote fees, thresholds, and estimates present in current store settings." },
  { id: "checkout", title: "Place an order", match: /checkout|payment|gcash|paymongo|\bcod\b|credit card|debit card|how.*buy|paano.*(?:bili|bayad)/i, action: { label: "Start with my bag", href: "/cart" }, steps: ["Sign in, open My bag, and select the products to buy.", "At checkout, select a saved delivery address, review any eligible voucher, and choose an available payment method.", "For card or GCash, finish email-code verification and the secure PayMongo payment. Then check the order in My Account."], note: "Cash on Delivery, GCash, and card availability are controlled by live store settings. Only the payment provider takes payment credentials; the assistant never does." },
  { id: "preferences", title: "Text size and communication preferences", match: /text size|font|notification|marketing|unsubscribe|communication|preference/i, action: account("profile", "Open shopping preferences"), steps: ["Open My Account, then Profile, and find Shopping preferences.", "Choose a text size for this browser, or adjust Delivery updates and Home Circle notes.", "Select Save preferences for communication changes."], note: "Essential security and transaction messages are separate from promotional preferences. Text size is browser-specific." },
  { id: "privacy", title: "Privacy and cookie choices", match: /privacy|personal data|delete.*account|cookies?|consent|terms|policy/i, action: { label: "Read privacy information", href: "/privacy" }, steps: ["Open Privacy, Terms, Refunds, or Cookie policy from the website footer.", "For browser cookie choices, open Cookie policy and select Open cookie settings.", "For account access, correction, or deletion requests, contact customer care through Support."], note: "Do not promise immediate deletion of legally required transaction records. The chatbot provides navigation, not legal advice." },
  { id: "support", title: "Speak with customer care", match: /support|ticket|human|agent|complaint|contact|tulong|help|not loading|keeps loading|blank|stuck/i, action: account("support", "Contact customer support"), steps: ["Open My Account, then Support, and start a ticket.", "Explain the issue and include the relevant order number, what you expected, and what happened.", "Check the ticket for staff replies. Use the Contact page if you cannot sign in."], note: "Do not include passwords, OTPs, full card details, or wallet PINs. The assistant has not submitted a ticket on your behalf and cannot promise a staff response time." },
];

export const normalizeQuestion = (text: string) => text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
export function conversationQuery(message: string, history: ConversationMessage[]) {
  const followUp = /^(?:and |also |what about|how about|why|when|which|that|this|it |the (?:first|second|third)|yes|no|still|same|then|paano|bakit|saan|ganun|hindi|oo)/i.test(message) || /\b(its|those|these|that one|this one|step by step)\b/i.test(message) || /^(?:under|below|up to|budget|₱|php|\d)/i.test(message);
  const previous = history.filter(item => item.role === "user").slice(-2).map(item => item.content).join(" ");
  return followUp && previous ? `${previous} ${message}` : message;
}
export function findHelpGuides(message: string, history: ConversationMessage[] = []) {
  const direct = HELP_GUIDES.filter(guide => guide.match.test(message));
  return (direct.length ? direct : HELP_GUIDES.filter(guide => guide.match.test(conversationQuery(message, history)))).slice(0, 3);
}

const STATIC_PATHS = new Set(["/", "/home", "/living-room", "/bedroom", "/dining-room", "/new-arrivals", "/compare", "/about", "/contact", "/faq", "/privacy", "/terms", "/refunds", "/cookies", "/wishlist", "/cart", "/login", "/forgot-password", "/profile"]);
const TABS = new Set(["profile", "orders", "addresses", "payments", "support", "home-circle", "security"]);
export function safeAssistantPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\s%#]/.test(value) || value.startsWith("//")) return null;
  const [path, query] = value.split("?");
  if (path === "/profile" && query) return /^tab=[a-z-]+$/.test(query) && TABS.has(query.slice(4)) ? value : null;
  if (query) return null;
  return STATIC_PATHS.has(path) || /^\/products\/[a-z0-9][a-z0-9-]{0,100}$/i.test(path) ? value : null;
}
export function safeAssistantActions(value: unknown): AssistantAction[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const path = safeAssistantPath(item.href);
    if (!path || typeof item.label !== "string" || seen.has(path)) return [];
    seen.add(path);
    return [{ label: item.label.replace(/[<>*_`#]/g, "").slice(0, 70), href: path }];
  }).slice(0, 4);
}

export function cleanAssistantReply(value: string): string {
  return value.replace(/<(think|analysis)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi, "")
    .replace(/```[\s\S]*?(?:```|$)/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/https?:\/\/\S+/gi, "the Contact page")
    .replace(/(?:^|\s)\/(?:[a-z][a-z0-9/?=&-]*)/gi, " the linked page")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")
    .replace(/[*`_]/g, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*[-•–]\s+/gm, "")
    .replace(/[→⇒➜]/g, ", then ")
    .replace(/[ \t]+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}

// Input never needs credentials. Stop before persistence or forwarding to the AI.
export function containsSensitiveChatData(value: string) {
  return /\b(?:otp|verification code|password|pin|cvv|cvc)\s*(?:is|:|=|ko ay)?\s*[\d]{3,8}\b/i.test(value) || /\b(?:password|api[_ -]?key|secret)\s*(?:is|:|=)\s*\S{4,}/i.test(value) || /\b(?:\d[ -]?){13,19}\b/.test(value);
}

export type CatalogEntry = { id: string; name: string; price: number; stock: number | null; category?: string; subcategory?: string; material?: string; color?: string; dimensions?: string; description?: string; productPath?: string };
const words = (value: string) => normalizeQuestion(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(word => word.length > 1);
const productTypes = [/\b(sofas?|couch(?:es)?)\b/i, /\b(chairs?|upuan)\b/i, /\b(tables?|mesa)\b/i, /\b(beds?|kama)\b/i, /\b(cabinets?|aparador)\b/i, /\b(wardrobes?)\b/i, /\b(dressers?)\b/i, /\b(nightstands?)\b/i, /\b(tv stands?|tv bench(?:es)?)\b/i, /\b(shel(?:f|ves)|shelving)\b/i, /\b(desks?)\b/i];
export function selectRelevantProducts(products: CatalogEntry[], message: string, history: ConversationMessage[] = [], currentPath = "") {
  const query = conversationQuery(message, history);
  const currentTypes = productTypes.filter(type => type.test(message));
  const types = currentTypes.length ? currentTypes : productTypes.filter(type => type.test(query));
  const queryWords = new Set(words(query));
  const budgets = [...query.matchAll(/(?:under|below|maximum|max|budget(?:\s+(?:of|is))?|up\s+to|less than|hanggang)\s*(?:php|₱|p)?\s*([\d,]+(?:\.\d+)?)\s*(k)?\b/gi)];
  const budget = budgets.at(-1);
  const maximum = budget ? Number(budget[1].replace(/,/g, "")) * (budget[2] ? 1000 : 1) : null;
  const requiresStock = /\b(in stock|available|availability|buy|bili|recommend|suggest)\b/i.test(query);
  const explicit = products.filter(product => queryWords.has(product.id.toLowerCase()) || query.toLowerCase().includes(product.name.toLowerCase()));
  const pool = products.filter(product => {
    if (maximum !== null && product.price > maximum) return false;
    if (requiresStock && !(product.stock !== null && product.stock > 0)) return false;
    return !types.length || types.some(type => type.test(`${product.name} ${product.subcategory || ""}`));
  });
  // Never widen an empty constrained search to unrelated or over-budget products.
  return pool.map(product => ({ product, score: (explicit.includes(product) ? 100 : 0) + (product.productPath === currentPath ? 70 : 0) + words(`${product.name} ${product.category} ${product.subcategory} ${product.material} ${product.color}`).reduce((sum, word) => sum + (queryWords.has(word) ? 3 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price).slice(0, 6).map(item => item.product);
}

export function requestedOrderNumber(message: string) { return message.match(/\bCC[- ]?(\d{3,12})\b/i)?.[1] ?? null; }
export function customerDataPlan(message: string, history: ConversationMessage[] = []) {
  const query = conversationQuery(message, history);
  return {
    orders: /\b(order|orders|tracking|shipment|refund|return|cancel|paid|charged|nabawasan|nasaan|bayad)\b|\bCC[- ]?\d{3,12}\b/i.test(query),
    loyalty: /points|home circle|loyalty|tier|membership|voucher|reward|convert|redeem/i.test(query),
    returns: /return|ibalik|damaged|broken|defect/i.test(query),
    tickets: /(?:my|aking|status|reply|replies|update).*\b(?:tickets?|support)\b|\b(?:tickets?|support)\b.*(?:status|reply|replies|update)/i.test(query),
  };
}
export const peso = (value: unknown) => typeof value !== "number" || !Number.isFinite(value) ? "amount unavailable" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value);
