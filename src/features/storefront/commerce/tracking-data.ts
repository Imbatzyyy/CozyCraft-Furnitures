import type { DbOrder } from '@/services/supabase/client';

const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value)
  ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row)) : [];
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;

// API types describe complete records, but legacy rows and partial responses
// can contain null scalars or relationships. Keep that absence non-fatal.
export function safeTrackingOrder(input: DbOrder): DbOrder {
  return {
    ...input,
    status: text(input.status, 'unknown') as DbOrder['status'],
    payment_status: text(input.payment_status, 'Not recorded') as DbOrder['payment_status'],
    payment_method: text(input.payment_method),
    refund_status: text(input.refund_status) as DbOrder['refund_status'],
    shipping_address: Object.fromEntries(Object.entries(input.shipping_address || {}).filter(([,v])=>typeof v==='string')),
    order_items: records(input.order_items) as DbOrder['order_items'],
    order_status_history: records(input.order_status_history).filter(r=>typeof r.status==='string' && typeof r.changed_at==='string') as DbOrder['order_status_history'],
    payment_transactions: records(input.payment_transactions) as DbOrder['payment_transactions'],
  };
}
