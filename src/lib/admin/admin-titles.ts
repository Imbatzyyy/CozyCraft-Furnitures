import { adminPages, adminPathIsActive } from "./admin-navigation";

/** Short page name shown in the admin header, e.g. "Orders". */
export function adminPageLabel(pathname: string) {
  const path = pathname.replace(/\/$/, "");
  if (adminPathIsActive(path, "/admin/login")) return "Sign in";
  if (adminPathIsActive(path, "/admin/setup-account")) return "Account setup";
  if (adminPathIsActive(path, "/admin/products/new")) return "New product";
  return Object.entries(adminPages).find(([route]) => adminPathIsActive(path, route))?.[1].label ?? "Store admin";
}

/** "Orders · CozyCraft Admin" */
export function adminTitleForPath(pathname: string, storeName = "CozyCraft") {
  const label = adminPageLabel(pathname);
  const brand = storeName.replace(/\s+Furnitures?$/i, "").trim() || "CozyCraft";
  return `${label} · ${brand} Admin`;
}
