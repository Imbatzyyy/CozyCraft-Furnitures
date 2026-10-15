import { MOBILE_CARE_PAGES, mobilePageFor, mobilePageReference, mobileTaskSteps } from "./cozycraft-mobile-pages.ts";
import { findHelpGuides, type ConversationMessage, type HelpGuide } from "./cozycraft-assistant-knowledge.ts";

const guideDestinations: Record<string, string> = {
  tracking: "orders", "payment-issue": "orders", "payment-otp": "bag", vouchers: "membership", loyalty: "membership",
  phone: "profile", password: "security", devices: "security", addresses: "addresses", "payment-preferences": "payments",
  cancellation: "orders", returns: "orders", receipts: "orders", reviews: "orders", shopping: "bag", delivery: "bag",
  checkout: "bag", preferences: "preferences", privacy: "privacy", support: "support",
};
export function findMobileHelpGuides(message: string, history: ConversationMessage[]): HelpGuide[] {
  const guides = findHelpGuides(message, history).map(guide => {
    const page = MOBILE_CARE_PAGES.find(item => item.destination === guideDestinations[guide.id]);
    if (!page) return guide;
    const steps = page.destination === "orders" ? mobileTaskSteps(message) || page.steps : page.steps;
    const note = guide.id === "devices"
      ? "The mobile app has password settings, but no signed-in-devices or authenticator management screen in this navigation reference. Do not claim these controls exist in the app. Contact Care & Support if further help is needed."
      : `${page.purpose} Only use actions actually offered on the screen. The assistant does not perform account changes or transactions. Never retry a payment after being charged without checking its status or contacting support; never share passwords or codes.`;
    return { ...guide, title: page.title, steps, note };
  });
  const page = mobilePageFor(message);
  if (page && !guides.some(guide => guide.title === page.title)) guides.unshift({ id: `mobile-${page.destination}`, title: page.title, match: page.matches, steps: page.destination === "orders" ? mobileTaskSteps(message) || page.steps : page.steps, note: page.purpose, action: { label: page.label, href: "/profile" } });
  return guides.slice(0, 3);
}
export function mobileAssistantReference() {
  return {
    platform: "CozyCraft mobile app",
    pages: mobilePageReference(),
    rules: "Use these mobile screen labels and paths, not website footer links or website account tabs. Only offer directions when asked or needed. Product detail, checkout, order detail, review, invoice, and return dialogs are opened from their parent pages, never invented standalone routes. No mobile signed-in-devices or authenticator settings page is listed; do not invent one. Sign-in is required for private account actions. No action is performed by this assistant.",
    team: ["Prince Balane", "Joylyn Campuso", "Sammuel Guill Concepcion", "Angela Faith Suba", "Hydee Mae Sumalinog"],
    teamNote: "This is the mobile Developers roster, not a claim about historical company founders. For company history use Company History; do not substitute the website roster for the app team.",
  };
}

export function mobilePageOverview(message: string): string | null {
  if (!/\b(?:what|which|list|show|available|all)\b.*\b(?:pages|screens|sections)\b/i.test(message) || /\b(?:order|payment|status|my|error|failed)\b/i.test(message)) return null;
  return "The app’s main tabs are Home, Shop, Saved, Bag, and Account. Shop includes Living room, Bedroom, Dining room, product details, search, and comparison.\n\nAccount contains My Orders, Delivery Addresses, Payment Preferences, Care & Support, Home Circle, profile editing, password settings, shopping preferences, text size, and the app tour. The header bell opens Notifications.\n\nThe menu and Account information links include About CozyCraft, Company History, Developers, Contact Us, Terms of Service, and Privacy Policy. Sign-in, account creation, and password recovery are available from the welcome and account-access screens.\n\nCheckout and order-specific actions open from your bag or a selected order. Tell me which page or task you want help with.";
}
