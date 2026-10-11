import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveProtected } from "../_shared/security-boundary.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

// Compatibility endpoint. Committed database events own durable delivery.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cozycraft-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store",
};
serveProtected(async request => {
  const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers });
  if(request.method === "OPTIONS") return new Response("ok",{headers});
  if(request.method !== "POST") return json({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if(!url || !key) return json({error:"Notification service unavailable"},503);
  const body=await request.json().catch(()=>null);
  const id=body?.eventType === "support_reply" ? body.ticketId : body?.orderId;
  if(typeof body?.eventType!=="string" || typeof id!=="string" || !/^[0-9a-f-]{36}$/i.test(id)) return json({error:"Invalid notification request"},400);
  const client=createClient(url,key,{global:{headers:{Authorization:request.headers.get("Authorization") ?? ""}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.rpc("request_transactional_email",{p_event:body.eventType,p_entity:id}).abortSignal(AbortSignal.timeout(8000));
  if(error) return json({error:"Notification could not be queued. Check the event and your access."},error.code==='42501'?403:409);
  return json(data,data?.queued?202:200);
});
