import { useAdminOverview } from "./use-admin-overview";

export type AttentionCounts = {
  pending: number;
  fulfillment: number;
  cancellations: number;
  refunds: number;
  support: number;
  lowStock: number;
};

export function useAttentionCounts(owner: string | null, enabled: boolean) {
  const { data } = useAdminOverview<AttentionCounts>(owner, enabled);
  if (!data) return null;
  return {
    pending: Number(data.pending) || 0,
    fulfillment: Number(data.fulfillment) || 0,
    cancellations: Number(data.cancellations) || 0,
    refunds: Number(data.refunds) || 0,
    support: Number(data.support) || 0,
    lowStock: Number(data.lowStock) || 0,
  };
}
