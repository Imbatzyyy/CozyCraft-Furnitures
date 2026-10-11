import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { buildTransactionalEmail } from "../_shared/transactional-email.ts";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});

export async function handleTransactionalWorker(request:Request) {
  if(request.method!=="POST") return json({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL"),key=request.headers.get("apikey"),resend=Deno.env.get("RESEND_API_KEY");
  if(!url || !key) return json({error:"Authentication required"},401);
  if(!resend) return json({error:"Email provider unavailable"},503);
  // The service-only claim RPC verifies the credential; never trust input jobs.
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}});
  const {data:batch,error}=await client.rpc("claim_transactional_emails");
  if(error) return json({error:"Worker authorization or claim failed"},403);
  if(!batch?.lease) return json({claimed:0,sent:0,failed:0});
  let sent=0,failed=0;
  try {
    for(const job of batch.jobs ?? []) {
      let provider:string|null=null,failure:string|null=null,permanent=false;
      try {
        const response=await fetch("https://api.resend.com/emails",{
          method:"POST",signal:AbortSignal.timeout(12000),
          headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json","Idempotency-Key":`transactional-${job.id}`},
          body:JSON.stringify({from:Deno.env.get("RESEND_FROM_EMAIL") ?? "CozyCraft Furnitures <no-reply@auth.cozycraftfurnitures.com>",to:[job.payload.recipient],reply_to:job.payload.replyTo || undefined,...buildTransactionalEmail(job.payload)}),
        });
        const payload=await response.json().catch(()=>({}));
        if(response.ok && typeof payload.id==="string") provider=payload.id;
        else {
          failure=`Email provider status ${response.status}`;
          permanent=response.status>=400 && response.status<500 && ![408,409,429].includes(response.status);
        }
      } catch { failure="Email provider unavailable; queued for retry"; }
      const ack=await client.rpc("finish_transactional_email",{p_id:job.id,p_lease:batch.lease,p_provider:provider,p_error:failure,p_permanent:permanent});
      if(ack.error || ack.data!==true) return json({error:"Acknowledgement unavailable; leased jobs will recover"},503);
      provider?sent++:failed++;
      if(batch.jobs.length>1) await new Promise(resolve=>setTimeout(resolve,600));
    }
  } finally {
    await client.rpc("finish_transactional_email_batch",{p_lease:batch.lease});
  }
  return json({claimed:batch.jobs.length,sent,failed});
}
if(import.meta.main) Deno.serve(handleTransactionalWorker);
