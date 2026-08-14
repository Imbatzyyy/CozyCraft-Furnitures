import { describe, expect, it } from "vitest";
import { getLoyaltyTierProgress } from "./member-tiers";

describe("getLoyaltyTierProgress", () => {
  it("measures a member against the plus threshold", () => {
    expect(getLoyaltyTierProgress("member", 7_500)).toEqual({
      percent: 50,
      nextTier: "plus",
      remaining: 7_500,
    });
  });

  it("measures premium progress within its own tier range", () => {
    expect(getLoyaltyTierProgress("premium", 85_000)).toEqual({
      percent: 50,
      nextTier: "elite",
      remaining: 35_000,
    });
  });

  it("keeps elite members at the completed tier", () => {
    expect(getLoyaltyTierProgress("elite", 120_000)).toEqual({
      percent: 100,
      nextTier: null,
      remaining: 0,
    });
  });
});
