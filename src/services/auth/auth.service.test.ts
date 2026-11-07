import { describe, expect, it, vi } from "vitest";
import { isExistingAccountSignUpResult, signInForPortal } from "./auth.service";
import {
  adminAuthStorageKey,
  customerAuthStorageKey,
  supabase,
} from "@/services/supabase/client";

it("reports provider outages without calling them incorrect passwords", async () => {
  const login = vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValue({ data: { user: null, session: null }, error: { name: "AuthRetryableFetchError", status: 503, message: "Unavailable" } } as never);
  try {
    const result = await signInForPortal("fixture@example.invalid", "not-a-real-password", "customer");
    expect(result.reason).toBe("service_unavailable");
    expect(login).toHaveBeenCalledOnce();
  } finally { login.mockRestore(); }
});

describe("portal session isolation", () => {
  it("uses independent browser storage for customers and administrators", () => {
    expect(customerAuthStorageKey).not.toBe(adminAuthStorageKey);
    expect(customerAuthStorageKey).toContain("customer");
    expect(adminAuthStorageKey).toContain("admin");
  });
});

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
