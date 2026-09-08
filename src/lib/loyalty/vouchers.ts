import type { CircleReward } from "@/services/content/home-circle.service";
export const circleExchanges = [{points:100,value:100},{points:250,value:300},{points:500,value:700}] as const;
export function voucherEligible(voucher: CircleReward, subtotal: number, now=Date.now()) {
  return voucher.status === "available" && Date.parse(voucher.expires_at)>now && subtotal>=Number(voucher.minimum_order_amount);
}
export function voucherDiscount(voucher: CircleReward | null, subtotal: number, delivery: number, now=Date.now()) {
  if(!voucher || !voucherEligible(voucher,subtotal,now)) return 0;
  // Match apply_mobile_reward_to_order: leave at least PHP 1 payable.
  return Math.round(Math.min(Number(voucher.discount_amount),Math.max(0,subtotal+delivery-1))*100)/100;
}
