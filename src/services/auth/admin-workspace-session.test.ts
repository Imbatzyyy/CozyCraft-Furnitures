import { describe, expect, it } from "vitest";
import { adminWorkspaceSessionScope, workspaceScopeCanLoad } from "./admin-workspace-session";

const session = (aal: string, verified = true, sessionId = "login-one", issuedAt = 1) => ({
  access_token: `header.${btoa(JSON.stringify({ aal, session_id: sessionId, iat: issuedAt }))}.signature`,
  user: { id: "admin-one", factors: verified ? [{ status: "verified" }] : [] },
});

describe("admin workspace session identity", () => {
  it("waits for MFA instead of accepting the RLS-filtered empty AAL1 dataset", () => {
    expect(adminWorkspaceSessionScope(session("aal1"))).toBeNull();
    expect(adminWorkspaceSessionScope(session("aal2"))).toBe("admin:admin-one:login-one:aal2");
  });
  it("loads fresh password-only accounts without requiring an unenrolled authenticator", () => {
    expect(adminWorkspaceSessionScope(session("aal1", false))).toBe("admin:admin-one:login-one:aal1");
  });
  it("changes request identity when MFA completes even when the user ID is unchanged", () => {
    expect(adminWorkspaceSessionScope(session("aal1", false)))
      .not.toBe(adminWorkspaceSessionScope(session("aal2")));
  });
  it("reuses data for routine token refreshes but isolates another login to the same account", () => {
    expect(adminWorkspaceSessionScope(session("aal2", true, "login-one", 1)))
      .toBe(adminWorkspaceSessionScope(session("aal2", true, "login-one", 2)));
    expect(adminWorkspaceSessionScope(session("aal2", true, "login-two")))
      .not.toBe(adminWorkspaceSessionScope(session("aal2")));
  });
  it("rejects absent, malformed, and incomplete sessions", () => {
    expect(adminWorkspaceSessionScope(null)).toBeNull();
    expect(adminWorkspaceSessionScope({ access_token: "bad", user: { id: "admin-one" } })).toBeNull();
    expect(adminWorkspaceSessionScope(session("unknown"))).toBeNull();
    expect(adminWorkspaceSessionScope(session("aal2", true, ""))).toBeNull();
  });
  it("blocks admin requests before verification without blocking storefront requests", () => {
    expect(workspaceScopeCanLoad("admin:guest")).toBe(false);
    expect(workspaceScopeCanLoad("admin:verification-pending")).toBe(false);
    expect(workspaceScopeCanLoad("admin:admin-one:login-one:aal2")).toBe(true);
    expect(workspaceScopeCanLoad("customer:guest")).toBe(true);
    expect(workspaceScopeCanLoad("storefront")).toBe(true);
  });
});
