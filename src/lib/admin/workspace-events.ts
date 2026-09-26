// A single local invalidation signal reuses the existing authenticated realtime
// subscription. It never reloads the document or resets an administrator's draft.
export const ADMIN_DATA_CHANGED = "cozycraft:admin-data-changed";
export function notifyAdminDataChanged() {
  window.dispatchEvent(new Event(ADMIN_DATA_CHANGED));
}
export function usesPagedAdminOrders(pathname: string) {
  // Every admin route now owns a bounded read model. Do not bootstrap the
  // entire order graph simply because a different workspace tab was opened.
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
