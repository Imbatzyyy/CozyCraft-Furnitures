import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { buildVoucherEmail } from "../_shared/voucher-email.ts";
const json = (value: unknown, status=200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async request => {
  if (request.method !== 'POST') return json({error:'Method not allowed'},405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = request.headers.get('apikey');
  const resend = Deno.env.get('RESEND_API_KEY');
  if (!url || !key) return json({error:'Authentication required'},401);
  if (!resend) return json({error:'Email provider unavailable'},503);
  // Only the service-role grant can claim jobs. Never trust a caller-supplied
  // recipient, voucher value or expiry; all content is an immutable DB snapshot.
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:jobs,error}=await admin.rpc('claim_voucher_emails');
  if(error) return json({error:'Worker authorization failed'},403);
  let sent=0,failed=0;
  for(const job of jobs || []) {
    let providerId: string | null=null;
    let failure='';
    try {
      if(!job.recipient) throw new Error('Account email unavailable');
      const content=buildVoucherEmail(job);
      const response=await fetch('https://api.resend.com/emails',{
        method:'POST',signal:AbortSignal.timeout(20_000),
        headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json','Idempotency-Key':`voucher-claim-${job.redemption_id}`},
        body:JSON.stringify({from:Deno.env.get('RESEND_FROM_EMAIL') || 'CozyCraft Furnitures <no-reply@auth.cozycraftfurnitures.com>',to:[job.recipient],...content}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok || !payload.id) throw new Error(`Email provider status ${response.status}`);
      providerId=payload.id;
    } catch(cause) { failure=cause instanceof Error ? cause.message.slice(0,200) : 'Email delivery failed'; }
    const {error:saveError}=await admin.from('voucher_claim_emails').update(providerId ? {
      status:'sent',sent_at:new Date().toISOString(),provider_message_id:providerId,error_message:null,
    } : {status:job.attempts>=6 ? 'failed':'queued',error_message:failure,next_attempt_at:new Date(Date.now()+job.attempts*120_000).toISOString()})
      .eq('redemption_id',job.redemption_id).eq('lease_id',job.lease_id).eq('status','sending');
    if(saveError) console.error('Voucher email acknowledgement failed',job.redemption_id);
    providerId ? sent++ : failed++;
    // Small batches and pacing protect the shared provider rate limit.
    if((jobs?.length || 0)>1) await new Promise(resolve=>setTimeout(resolve,600));
  }
  return json({claimed:jobs?.length || 0,sent,failed});
});
