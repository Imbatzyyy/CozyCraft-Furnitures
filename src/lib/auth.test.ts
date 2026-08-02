import { describe, expect, it } from "vitest";
import { isExistingAccountSignUpResult } from "./auth";

describe("isExistingAccountSignUpResult", () => {
  it("detects Supabase's obfuscated duplicate signup response", () => {
    expect(
      isExistingAccountSignUpResult({
        data: { user: { identities: [] } },
        error: null,
      }),
    ).toBe(true);
  });

  it("detects the explicit duplicate-account error code", () => {
    expect(
      isExistingAccountSignUpResult({
        data: { user: null },
        error: { code: "user_already_exists", message: "User already exists" },
      }),
    ).toBe(true);
  });

  it("detects the legacy already-registered error message", () => {
    expect(
      isExistingAccountSignUpResult({
        data: { user: null },
        error: { message: "User already registered" },
      }),
    ).toBe(true);
  });

  it("allows a newly-created identity to continue to email verification", () => {
    expect(
      isExistingAccountSignUpResult({
        data: { user: { identities: [{ id: "new-email-identity" }] } },
        error: null,
      }),
    ).toBe(false);
  });
});
