import { describe, expect, it } from "vitest";
import {
  authenticatorChallengeRequired,
  clearPasswordRecoveryGrant,
  hasValidPasswordRecoveryGrant,
  passwordStatusFromRpc,
  shouldRecheckAuthenticator,
  urlContainsPasswordRecoveryCredentials,
  writePasswordRecoveryGrant,
} from "./account-security";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

describe("customer account MFA security", () => {
  it("requires a challenge only when an enrolled factor can raise AAL1 to AAL2", () => {
    expect(authenticatorChallengeRequired("aal1", "aal2")).toBe(true);
    expect(authenticatorChallengeRequired(null, "aal2")).toBe(true);
    expect(authenticatorChallengeRequired("aal2", "aal2")).toBe(false);
    expect(authenticatorChallengeRequired("aal1", "aal1")).toBe(false);
  });

  it.each([
    "SIGNED_IN",
    "TOKEN_REFRESHED",
    "MFA_CHALLENGE_VERIFIED",
    "USER_UPDATED",
  ])("rechecks assurance after %s", (event) => {
    expect(shouldRecheckAuthenticator(event)).toBe(true);
  });

  it("ignores unrelated auth events", () => {
    expect(shouldRecheckAuthenticator("PASSWORD_RECOVERY")).toBe(false);
  });
});

describe("customer password setup security", () => {
  it("keeps an unavailable password lookup distinct from no password", () => {
    expect(passwordStatusFromRpc(false, null)).toBe(false);
    expect(passwordStatusFromRpc(true, null)).toBe(true);
    expect(passwordStatusFromRpc(false, new Error("offline"))).toBeNull();
    expect(passwordStatusFromRpc("false", null)).toBeNull();
  });

  it("accepts a short-lived recovery grant only for the matching account", () => {
    const storage = memoryStorage();
    expect(writePasswordRecoveryGrant(storage, "customer-1", 1_000)).toBe(true);
    expect(
      hasValidPasswordRecoveryGrant(storage, "customer-1", 1_000 + 29 * 60_000),
    ).toBe(true);
    expect(hasValidPasswordRecoveryGrant(storage, "customer-2", 1_500)).toBe(
      false,
    );
  });

  it("expires and clears old recovery grants", () => {
    const storage = memoryStorage();
    writePasswordRecoveryGrant(storage, "customer-1", 1_000);
    expect(
      hasValidPasswordRecoveryGrant(storage, "customer-1", 1_000 + 31 * 60_000),
    ).toBe(false);
    clearPasswordRecoveryGrant(storage);
  });

  it("recognizes only recovery URLs that carry verification credentials", () => {
    expect(
      urlContainsPasswordRecoveryCredentials({
        hash: "#access_token=token&type=recovery",
        search: "?mode=setup",
      }),
    ).toBe(true);
    expect(
      urlContainsPasswordRecoveryCredentials({ hash: "", search: "?mode=setup" }),
    ).toBe(false);
    expect(
      urlContainsPasswordRecoveryCredentials({
        hash: "",
        search: "?token_hash=token&type=recovery",
      }),
    ).toBe(true);
  });
});
