import { describe, expect, it } from "vitest";
import {
  adminPathsForRole,
  canAccessAdminPath,
  canManageFinancialOperations,
  type WorkspaceRole,
} from "./access";

const allPaths = [
  "/admin",
  "/admin/products",
  "/admin/orders",
  "/admin/payments",
  "/admin/customers",
  "/admin/member-tiers",
  "/admin/settings",
  "/admin/team-access",
];

describe("admin role permissions", () => {
  it("gives super administrators every registered workspace route", () => {
    expect(adminPathsForRole("Super Administrator", allPaths)).toEqual(allPaths);
  });

  it("prevents administrators from team and settings management", () => {
    expect(canAccessAdminPath("Administrator", "/admin/payments", allPaths)).toBe(true);
    expect(canAccessAdminPath("Administrator", "/admin/settings", allPaths)).toBe(false);
    expect(canAccessAdminPath("Administrator", "/admin/team-access", allPaths)).toBe(false);
  });

  it("keeps staff away from financial and customer record pages", () => {
    expect(canAccessAdminPath("Staff", "/admin/orders/ORDER-1", allPaths)).toBe(true);
    expect(canAccessAdminPath("Staff", "/admin/payments", allPaths)).toBe(false);
    expect(canAccessAdminPath("Staff", "/admin/customers", allPaths)).toBe(false);
    expect(canAccessAdminPath("Staff", "/admin/member-tiers", allPaths)).toBe(false);
  });

  it("allows administrators to monitor member tiers", () => {
    expect(canAccessAdminPath("Administrator", "/admin/member-tiers", allPaths)).toBe(true);
  });

  it.each<[WorkspaceRole, boolean]>([
    ["Staff", false],
    ["Administrator", true],
    ["Super Administrator", true],
  ])("sets financial authority for %s", (role, expected) => {
    expect(canManageFinancialOperations(role)).toBe(expected);
  });
});
