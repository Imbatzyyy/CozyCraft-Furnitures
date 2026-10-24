/** Public-facing names only. Routes and role permissions remain unchanged. */
export const adminPages = {
  "/admin": { label: "Dashboard", description: "Today's sales and tasks that need attention", keywords: "overview summary home" },
  "/admin/orders": { label: "Orders", description: "Prepare orders and update deliveries", keywords: "sales commerce fulfillment packing delivery" },
  "/admin/payments": { label: "Payments", description: "Check payments, refunds and receipts", keywords: "transactions money commerce" },
  "/admin/reports": { label: "Reports", description: "View sales results and predictions", keywords: "insights analytics forecasts intelligence exports" },
  "/admin/products": { label: "Products", description: "Add and edit furniture listings", keywords: "catalog items furniture" },
  "/admin/inventory": { label: "Stock levels", description: "Check quantities and restock products", keywords: "inventory warehouse units" },
  "/admin/categories": { label: "Product categories", description: "Organize products by room and type", keywords: "catalog collections groups" },
  "/admin/customers": { label: "Customers", description: "View customer profiles and order history", keywords: "people accounts buyers" },
  "/admin/support": { label: "Customer messages", description: "Reply to questions and help requests", keywords: "support inbox tickets help" },
  "/admin/reviews": { label: "Customer reviews", description: "Read product ratings and customer feedback", keywords: "stars comments" },
  "/admin/member-tiers": { label: "Member rewards", description: "Check Home Circle points, tiers and reward activity", keywords: "loyalty member tiers vouchers" },
  "/admin/content": { label: "Pages & emails", description: "Edit website pages, banners and customer emails", keywords: "content publishing studio homepage newsletter campaigns" },
  "/admin/experience": { label: "Shopping experience", description: "Manage delivery areas, product searches and alerts", keywords: "merchandising synonyms back in stock price drop" },
  "/admin/settings": { label: "Store settings", description: "Manage store details and preferences", keywords: "configuration administration" },
  "/admin/team": { label: "Staff & permissions", description: "Invite staff and choose what they can access", keywords: "team access roles administration" },
  "/admin/system-health": { label: "Website status", description: "Check website issues and background tasks", keywords: "operations health system queues errors" },
  "/admin/activity-logs": { label: "Change history", description: "See who made changes and when", keywords: "activity logs audit trail" },
} as const;

export type AdminNavPath = keyof typeof adminPages;
type Section = { id: string; label: string; description: string; alwaysOpen?: boolean; paths: readonly AdminNavPath[] };
export const adminNavigationSections = [
  { id: "daily", label: "Daily tasks", description: "Your most-used pages", alwaysOpen: true, paths: ["/admin", "/admin/orders", "/admin/payments", "/admin/reports"] },
  { id: "products", label: "Products & stock", description: "Items and stock counts", paths: ["/admin/products", "/admin/inventory", "/admin/categories"] },
  { id: "customers", label: "Customers & help", description: "Messages and rewards", paths: ["/admin/customers", "/admin/support", "/admin/reviews", "/admin/member-tiers"] },
  { id: "website", label: "Website", description: "Pages and shopping tools", paths: ["/admin/content", "/admin/experience"] },
  { id: "settings", label: "Settings & team", description: "Access and preferences", paths: ["/admin/settings", "/admin/team", "/admin/system-health", "/admin/activity-logs"] },
] as const satisfies readonly Section[];

export const adminPathIsActive = (pathname: string, path: string) => {
  const current = pathname.replace(/\/+$/, "");
  return current === path || (path !== "/admin" && current.startsWith(`${path}/`));
};

/** Search recognizes the previous names as well as plain-language tasks. */
export function adminPageMatches(path: AdminNavPath, query: string) {
  const page = adminPages[path];
  const text = `${page.label} ${page.description} ${page.keywords}`.toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => text.includes(word));
}
