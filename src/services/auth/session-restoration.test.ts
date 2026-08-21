import { describe, expect, it } from "vitest";
import {
  customerAuthEventAction,
  customerSessionRetryDelay,
} from "./session-restoration";

describe("customerAuthEventAction", () => {
  it("leaves a null INITIAL_SESSION for getSession to resolve", () => {
    expect(customerAuthEventAction("INITIAL_SESSION", false)).toBe("ignore");
  });

  it("ignores other null transient auth events", () => {
    expect(customerAuthEventAction("TOKEN_REFRESHED", false)).toBe("ignore");
  });

  it("restores account data when an event carries a user session", () => {
    expect(customerAuthEventAction("SIGNED_IN", true)).toBe("restore");
  });

  it("honors an explicit sign-out", () => {
    expect(customerAuthEventAction("SIGNED_OUT", false)).toBe("clear");
  });
});

describe("customerSessionRetryDelay", () => {
  it("uses capped exponential backoff", () => {
    expect(customerSessionRetryDelay(0)).toBe(400);
    expect(customerSessionRetryDelay(1)).toBe(800);
    expect(customerSessionRetryDelay(4)).toBe(6_400);
    expect(customerSessionRetryDelay(5)).toBe(8_000);
    expect(customerSessionRetryDelay(50)).toBe(8_000);
  });

  it("normalizes invalid negative attempts", () => {
    expect(customerSessionRetryDelay(-4)).toBe(400);
  });
});
