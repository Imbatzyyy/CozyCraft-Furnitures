import { supabase } from "@/services/supabase/client";
import type { LoyaltyTier } from "@/lib/loyalty/member-tiers";

export type CircleAccount = { points_balance: number; lifetime_eligible_spend: number; tier: LoyaltyTier; tier_valid_until: string | null };
export type CircleActivity = { id: string; points: number; description: string; created_at: string };
export type CircleReward = { id: string; discount_amount: number; minimum_order_amount: number; reward_source: string; status: string; expires_at: string };
export type CircleSnapshot = { account: CircleAccount; activity: CircleActivity[]; rewards: CircleReward[]; rewardHasMore?: boolean };

export async function loadCircleRewards(userId: string, page: number, signal: AbortSignal) {
  const from = Math.max(0, Math.floor(page)) * 6;
  const {data,error} = await supabase.from("mobile_loyalty_redemptions")
    .select("id,discount_amount,minimum_order_amount,reward_source,status,expires_at")
    .eq("user_id",userId).eq("status","available").gt("expires_at",new Date().toISOString())
    .order("expires_at",{ascending:true}).order("id",{ascending:true}).range(from,from+6).abortSignal(signal);
  if(error) throw error;
  return {rows:(data || []).slice(0,6) as CircleReward[],hasMore:(data || []).length>6};
}

export async function claimCircleReward(points: number, requestKey: string, signal: AbortSignal) {
  const {data,error}=await supabase.rpc("claim_home_circle_reward",{p_points:points,p_request_key:requestKey}).abortSignal(signal);
  if(error) throw error;
  if(!data?.id) throw new Error("Your claim could not be confirmed. Retry to safely check the same claim.");
  return data as CircleReward;
}

// Component-owned cache: discarded when the signed-in profile unmounts. No local
// storage of account data, no realtime channel and no recurring database polling.
export async function loadHomeCircle(userId: string, signal: AbortSignal): Promise<CircleSnapshot> {
  const accountResult = await supabase.from("mobile_loyalty_accounts")
    .select("points_balance,lifetime_eligible_spend,tier,tier_valid_until")
    .eq("user_id", userId).abortSignal(signal).maybeSingle();
  if (accountResult.error) throw accountResult.error;
  let account = accountResult.data;
  if (!account) {
    const initialized = await supabase.rpc("get_mobile_loyalty").abortSignal(signal);
    if (initialized.error) throw initialized.error;
    account = initialized.data;
  }
  if (!account) throw new Error("Your membership is not available yet. Please try again.");
  const [activity, rewards] = await Promise.all([
    supabase.from("mobile_loyalty_transactions").select("id,points,description,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20).abortSignal(signal),
    loadCircleRewards(userId,0,signal),
  ]);
  if (activity.error) throw activity.error;
  return { account: account as CircleAccount, activity: activity.data || [], rewards: rewards.rows, rewardHasMore: rewards.hasMore };
}
