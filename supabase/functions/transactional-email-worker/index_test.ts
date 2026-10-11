import assert from "node:assert/strict";
import {handleTransactionalWorker} from "./index.ts";
import {buildTransactionalEmail} from "../_shared/transactional-email.ts";
const snapshot={recipient:"fixture@example.invalid",recipientName:"<script>",subject:"Order {{order_number}}",heading:"Order update",body:"Now {{status}}",variables:{order_number:"CC-FIXTURE",status:"packed"},storeName:"CozyCraft"};
Deno.test("email rendering escapes content and includes logo, readable text and account link",()=>{
  const mail=buildTransactionalEmail(snapshot);
  assert.ok(mail.html.includes("email-logo.png"));assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.text.includes("Now packed"));assert.equal(mail.subject,"Order CC-FIXTURE");
});
Deno.test("worker verifies service grant; retries keep the same provider idempotency key",async()=>{
  Deno.env.set("SUPABASE_URL","https://fixture.invalid");Deno.env.set("RESEND_API_KEY","fixture-provider");
  const original=globalThis.fetch;
  let authorized=false,attempt=0;
  const sent:string[]=[],ack:any[]=[];
  globalThis.fetch=async(input,init)=>{
    const url=String(input);
    if(url.includes('claim_transactional_emails')) return Response.json(authorized?{lease:'lease',jobs:[{id:'job',payload:snapshot}]}:{message:'Denied'},{status:authorized?200:403});
    if(url.includes('api.resend.com')) {sent.push(new Headers(init?.headers).get('Idempotency-Key')!);return Response.json(attempt++?{id:'provider-id'}:{message:'Busy'},{status:attempt===1?429:200});}
    if(url.includes('finish_transactional_email_batch')) return Response.json(null);
    if(url.includes('finish_transactional_email')) {ack.push(JSON.parse(String(init?.body)));return Response.json(true);}
    throw new Error('Unexpected request');
  };
  const req=()=>new Request('https://fixture.invalid',{method:'POST',headers:{apikey:'fixture-key'}});
  try {
    assert.equal((await handleTransactionalWorker(req())).status,403);assert.equal(sent.length,0);
    authorized=true;
    assert.equal((await handleTransactionalWorker(req())).status,200);
    assert.equal(ack[0].p_permanent,false);assert.equal(ack[0].p_provider,null);
    assert.equal((await handleTransactionalWorker(req())).status,200);
    assert.equal(ack[1].p_provider,'provider-id');assert.deepEqual(sent,['transactional-job','transactional-job']);
  } finally {globalThis.fetch=original;}
});
