import {describe,it,expect} from 'vitest';
import {circleExchanges,voucherEligible,voucherDiscount} from './vouchers';
import type {CircleReward} from '@/services/content/home-circle.service';
import {buildPaymongoLineItems} from '../../../supabase/functions/_shared/paymongo-line-items';
import {buildVoucherEmail} from '../../../supabase/functions/_shared/voucher-email';
const voucher:CircleReward={id:'test',discount_amount:300,minimum_order_amount:5000,reward_source:'points',status:'available',expires_at:'2026-10-01T00:00:00Z'};
const now=Date.parse('2026-09-08T00:00:00Z');
describe('shared voucher rules',()=>{
  it('matches app conversion values',()=>expect(circleExchanges).toEqual([{points:100,value:100},{points:250,value:300},{points:500,value:700}]));
  it('enforces expiry at the exact instant and minimum merchandise spend',()=>{
    expect(voucherEligible(voucher,5000,now)).toBe(true);expect(voucherEligible(voucher,4999,now)).toBe(false);
    expect(voucherEligible(voucher,5000,Date.parse(voucher.expires_at))).toBe(false);
    expect(voucherEligible({...voucher,status:'applied'},5000,now)).toBe(false);
  });
  it('matches the database one-peso payable floor',()=>{
    expect(voucherDiscount(voucher,5000,100,now)).toBe(300);
    expect(voucherDiscount({...voucher,minimum_order_amount:0},50,0,now)).toBe(49);
    expect(voucherDiscount(null,5000,100,now)).toBe(0);
  });
  it.each(['card','gcash'])('charges the discounted database amount for %s',()=>{
    const items=buildPaymongoLineItems({orderNumber:'TEST',total:4800,deliveryFee:100,rewardDiscount:300,items:[{product_name:'Sofa',unit_price:5000,quantity:1}]});
    expect(items.reduce((s,i)=>s+i.amount*i.quantity,0)).toBe(480000);expect(items).toHaveLength(1);
    expect(items[0].name).toContain('Home Circle reward applied');
  });
  it('keeps non-discounted quantities and delivery exact',()=>{
    const items=buildPaymongoLineItems({orderNumber:'TEST',total:10250,deliveryFee:250,rewardDiscount:0,items:[{product_name:'Chair',unit_price:5000,quantity:2}]});
    expect(items.reduce((s,i)=>s+i.amount*i.quantity,0)).toBe(1025000);expect(items).toHaveLength(2);
  });
  it('rejects invalid provider totals',()=>expect(()=>buildPaymongoLineItems({orderNumber:'TEST',total:NaN,deliveryFee:0,rewardDiscount:100,items:[]})).toThrow());
  it('renders branded HTML and plain text with stored expiry in Philippine time',()=>{
    const email=buildVoucherEmail({...voucher,points_cost:250});expect(email.html).toContain('/email-logo.png');
    expect(email.html).toContain('₱300 off');expect(email.html).toContain('October 1, 2026');expect(email.text).toContain('250 points');
    expect(email.text).toContain('Philippine time');expect(email.html).toContain('profile?tab=home-circle');
  });
});
