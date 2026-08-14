export type LoyaltyTier = "member" | "plus" | "premium" | "elite";

export const loyaltyTierOrder: LoyaltyTier[] = ["member", "plus", "premium", "elite"];

export const loyaltyTierMinimums: Record<LoyaltyTier, number> = {
  member: 0,
  plus: 15_000,
  premium: 50_000,
  elite: 120_000,
};

export function getLoyaltyTierProgress(tier: LoyaltyTier, lifetimeEligibleSpend: number) {
  const index = loyaltyTierOrder.indexOf(tier);
  if (index === loyaltyTierOrder.length - 1) {
    return { percent: 100, nextTier: null as LoyaltyTier | null, remaining: 0 };
  }

  const currentMinimum = loyaltyTierMinimums[tier];
  const nextTier = loyaltyTierOrder[index + 1];
  const nextMinimum = loyaltyTierMinimums[nextTier];
  const progress = lifetimeEligibleSpend - currentMinimum;
  const required = nextMinimum - currentMinimum;

  return {
    percent: Math.max(0, Math.min(100, (progress / required) * 100)),
    nextTier,
    remaining: Math.max(0, nextMinimum - lifetimeEligibleSpend),
  };
}
