import { describe, it, expect } from "vitest";
import { adminMfaGate } from "./admin-mfa-gate";
describe("administrator MFA gate", () => {
  it("routes unenrolled administrators to setup, including unknown policy", () => {
    expect(adminMfaGate("aal1", "aal1")).toBe("enroll");
  });
  it("requires existing factors even when enrollment is optional", () => {
    expect(adminMfaGate("aal1", "aal2", false)).toBe("challenge");
  });
  it("admits verified administrators", () => {
    expect(adminMfaGate("aal2", "aal2")).toBe("ready");
  });
  it("honors an explicit optional-enrollment policy", () => {
    expect(adminMfaGate("aal1", "aal1", false)).toBe("ready");
  });
});
