import assert from "node:assert/strict";
import { handlePaymongoWebhook } from "./index.ts";
const secret="fixture-webhook-secret";
Deno.env.set("SUPABASE_URL","https://fixture.invalid");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY","fixture-service");
Deno.env.set("PAYMONGO_WEBHOOK_SECRET",secret);
const fixture=(live=false)=>({data:{id:"evt_fixture",type:"event",attributes:{type:"checkout_session.payment.paid",livemode:live,data:{id:"cs_fixture",type:"checkout_session",attributes:{livemode:live,reference_number:"CC-FIXTURE",payments:[{id:"pay_fixture",attributes:{status:"paid",amount:10000,currency:"PHP",livemode:live}}]}}}}});
async function signed(payload:unknown,live=false,age=0) {
  const raw=JSON.stringify(payload),time=Math.floor(Date.now()/1000)-age;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${time}.${raw}`));
  const sig=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  return new Request("https://fixture.invalid/webhook",{method:"POST",body:raw,headers:{"Paymongo-Signature":`t=${time},te=${live?'incorrect':sig},li=${live?sig:'incorrect'}`}});
}
Deno.test("nested paid events settle without browser return; duplicate delivery is idempotent",async()=>{
  const original=globalThis.fetch;
  for(const live of [false,true]) {
    let settled=false,effects=0;
    globalThis.fetch=async(input,init)=>{
      if(String(input).includes("payment_transactions")) return Response.json({id:"txn",order_id:"order",status:settled?"paid":"pending",amount:100,currency:"PHP",livemode:live,provider_payment_id:settled?"pay_fixture":null,orders:{order_number:"CC-FIXTURE",total:100}});
      assert.ok(String(input).includes("settle_paymongo_order"));
      const body=JSON.parse(String(init?.body));
      assert.equal(body.p_livemode,live); assert.equal(body.p_provider_payment_id,"pay_fixture");
      assert.equal(body.p_raw_payload.data.id,"cs_fixture");
      const result=settled?"already_paid":"settled";
      if(!settled) effects++;
      settled=true;
      return Response.json(result);
    };
    try {
      for(let attempt=0;attempt<2;attempt++) assert.equal((await handlePaymongoWebhook(await signed(fixture(live),live))).status,200);
      assert.equal(effects,1);
    } finally {globalThis.fetch=original;}
  }
});
Deno.test("unpaid, mismatched amount/currency/mode/reference events never settle",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async input=>{
    assert.ok(String(input).includes("payment_transactions"),"invalid event must not settle");
    return Response.json({id:"txn",order_id:"order",amount:100,currency:"PHP",livemode:false,orders:{order_number:"CC-FIXTURE",total:100}});
  };
  try {
    for(const kind of ["amount","currency","status","mode","reference"]) {
      const data=fixture();const attrs=data.data.attributes.data.attributes;
      if(kind==='amount') attrs.payments[0].attributes.amount=9999;
      if(kind==='currency') attrs.payments[0].attributes.currency='USD';
      if(kind==='status') attrs.payments[0].attributes.status='pending';
      if(kind==='mode') data.data.attributes.livemode=true;
      if(kind==='reference') attrs.reference_number='OTHER';
      assert.equal((await handlePaymongoWebhook(await signed(data,kind==='mode'))).status,409);
    }
  } finally {globalThis.fetch=original;}
});
Deno.test("invalid or stale signatures are rejected before database access",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error("No network expected");};
  try {
    assert.equal((await handlePaymongoWebhook(await signed(fixture(),false,600))).status,401);
    const request=await signed(fixture());request.headers.set("Paymongo-Signature","t=1,te=bad");
    assert.equal((await handlePaymongoWebhook(request)).status,401);
  } finally {globalThis.fetch=original;}
});
