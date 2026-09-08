import {describe,it,expect} from 'vitest';
import {trackingDate,trackingSteps} from './FullTracking';
import type {DbOrder} from '@/services/supabase/client';
const order={created_at:'2026-09-08T04:00:00Z',status:'processing',order_status_history:[]} as unknown as DbOrder;
describe('full tracking truthfulness',()=>{
  it('uses creation time only for order placement',()=>{const steps=trackingSteps(order);expect(steps[0].at).toBe(order.created_at);expect(steps[1].complete).toBe(true);expect(steps[1].at).toBeNull();expect(steps[2].complete).toBe(false);});
  it('does not turn cancellation into successful delivery',()=>{expect(trackingSteps({...order,status:'cancelled'}).find(s=>s.status==='delivered')?.complete).toBe(false);});
  it('uses the latest recorded occurrence',()=>{const result=trackingSteps({...order,order_status_history:[{status:'processing',changed_at:'2026-09-08T05:00:00Z'},{status:'processing',changed_at:'2026-09-08T06:00:00Z'}] as DbOrder['order_status_history']});expect(result[1].at).toBe('2026-09-08T06:00:00Z');});
  it('handles missing or invalid dates without crashing',()=>{expect(trackingDate('bad')).toBe('Not recorded');expect(trackingDate(null)).toBe('Not recorded');expect(trackingDate(order.created_at)).toContain('12:00');});
});
