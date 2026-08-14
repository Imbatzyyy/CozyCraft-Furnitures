export type WorkspaceRole = "Staff" | "Administrator" | "Super Administrator";

const administratorPaths = [
  "/admin",
  "/admin/products",
  "/admin/categories",
  "/admin/inventory",
  "/admin/orders",
  "/admin/payments",
  "/admin/customers",
  "/admin/member-tiers",
  "/admin/experience",
  "/admin/reviews",
  "/admin/reports",
  "/admin/activity-logs",
  "/admin/support",
] as const;

const staffPaths = [
  "/admin",
  "/admin/products",
  "/admin/categories",
  "/admin/inventory",
  "/admin/orders",
  "/admin/reviews",
  "/admin/support",
] as const;

export function adminPathsForRole(role: WorkspaceRole, allPaths: string[]): string[] {
  if (role === "Super Administrator") return allPaths;
  return role === "Administrator" ? [...administratorPaths] : [...staffPaths];
}

export function canAccessAdminPath(role: WorkspaceRole, pathname: string, allPaths: string[]): boolean {
  return adminPathsForRole(role, allPaths).some(
    (path) => pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`)),
  );
}

export function canManageFinancialOperations(role: WorkspaceRole): boolean {
  return role === "Administrator" || role === "Super Administrator";
}
