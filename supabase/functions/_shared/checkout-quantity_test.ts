import assert from "node:assert/strict";
import { normalizeMobilePaymentIntent } from "./mobile-payment-authorization.ts";
const base={addressId:"00000000-0000-4000-8000-000000000001",checkoutKey:"00000000-0000-4000-8000-000000000002",paymentMethod:"card"};
Deno.test("web/mobile OTP normalization matches shared checkout quantity limits",()=>{
  assert.equal(normalizeMobilePaymentIntent({...base,items:[{product_id:"a",quantity:10},{product_id:"b",quantity:10}]}).items.length,2);
  for(const items of [
    [{product_id:"a",quantity:11}],
    [{product_id:"a",quantity:1.5}],
    [{product_id:"a",quantity:10},{product_id:"b",quantity:10},{product_id:"c",quantity:1}],
    [{product_id:"a",quantity:1},{product_id:"a",quantity:1}],
    Array.from({length:11},(_,n)=>({product_id:String(n),quantity:1})),
  ]) assert.throws(()=>normalizeMobilePaymentIntent({...base,items}));
});
