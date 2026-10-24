import { describe, expect, it } from "vitest";
import { adminNavigationSections, adminPageMatches, adminPages, adminPathIsActive } from "./admin-navigation";
import { adminPageLabel } from "./admin-titles";
import { adminPathsForRole, canAccessAdminPath, type WorkspaceRole } from "./access";

describe("plain-language admin navigation", () => {
  const paths = adminNavigationSections.flatMap(section => [...section.paths]);
  it("places every existing page exactly once, with daily tasks first", () => {
    expect(paths).toHaveLength(17);
    expect(new Set(paths).size).toBe(17);
    expect([...paths].sort()).toEqual(Object.keys(adminPages).sort());
    expect(adminNavigationSections[0].alwaysOpen).toBe(true);
    expect(paths.slice(0, 4)).toEqual(["/admin", "/admin/orders", "/admin/payments", "/admin/reports"]);
    expect(adminNavigationSections.map(group => group.label)).toEqual(["Daily tasks", "Products & stock", "Customers & help", "Website", "Settings & team"]);
  });
  it("keeps route titles and navigation labels consistent", () => {
    for (const path of paths) {
      expect(adminPageLabel(path)).toBe(adminPages[path].label);
      expect(adminPageLabel(`${path}/`)).toBe(adminPages[path].label);
    }
    expect(adminPageLabel("/admin/products/new")).toBe("New product");
    expect(adminPageLabel("/admin/products-other")).toBe("Store admin");
    expect(adminPathIsActive("/admin/orders", "/admin")).toBe(false);
    expect(adminPathIsActive("/admin/", "/admin")).toBe(true);
    expect(adminPathIsActive("/admin/orders/", "/admin/orders")).toBe(true);
  });
  it.each(["Staff", "Administrator", "Super Administrator"] as WorkspaceRole[])("preserves access for %s", role => {
    const allowed = adminPathsForRole(role, paths);
    expect(allowed.every(path => paths.includes(path as typeof paths[number]))).toBe(true);
    expect(canAccessAdminPath(role, "/admin/orders", paths)).toBe(true);
    expect(canAccessAdminPath(role, "/admin/team", paths)).toBe(role === "Super Administrator");
    expect(canAccessAdminPath(role, "/admin/settings", paths)).toBe(role === "Super Administrator");
    expect(canAccessAdminPath(role, "/admin/payments", paths)).toBe(role !== "Staff");
    expect(canAccessAdminPath(role, "/admin/reports", paths)).toBe(role !== "Staff");
  });
  it("can find renamed pages using familiar old names and customer tasks", () => {
    expect(adminPageMatches("/admin/inventory", "inventory")).toBe(true);
    expect(adminPageMatches("/admin/experience", "merchandising")).toBe(true);
    expect(adminPageMatches("/admin/system-health", "operations health")).toBe(true);
    expect(adminPageMatches("/admin/activity-logs", "audit logs")).toBe(true);
    expect(adminPageMatches("/admin/member-tiers", "home circle")).toBe(true);
    expect(adminPageMatches("/admin/support", "help requests")).toBe(true);
    expect(adminPageMatches("/admin/payments", "inventory")).toBe(false);
  });
});
