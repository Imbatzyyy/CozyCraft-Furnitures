import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const canonicalOrigin="https://www.cozycraftfurnitures.com";
const allowedOrigins=new Set([canonicalOrigin,"https://cozycraftfurnitures.com"]);
const cors=(r:Request)=>({"Access-Control-Allow-Origin":allowedOrigins.has(r.headers.get("Origin")??"")?r.headers.get("Origin")!:canonicalOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"});
const json=(r:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(r),"Content-Type":"application/json"}});

Deno.serve(async(request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors(request)});
  if(request.method!=="POST")return json(request,{error:"Method not allowed."},405);
  const authorization=request.headers.get("Authorization");
  if(!authorization)return json(request,{error:"Authentication required."},401);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY"),paymongo=Deno.env.get("PAYMONGO_SECRET_KEY");
  if(!url||!anon||!service||!paymongo)return json(request,{error:"Refund service is not configured."},503);
  const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user}}=await client.auth.getUser();
  if(!user)return json(request,{error:"Session expired."},401);
  const {data:profile}=await admin.from("profiles").select("role").eq("id",user.id).single();
  if(!profile||!["staff","admin","superadmin"].includes(profile.role))return json(request,{error:"Administrator access required."},403);
  const body=await request.json().catch(()=>({}));
  const returnId=typeof body.returnId==="string"?body.returnId:"";
  const {data:returnRequest,error:returnError}=await admin.from("return_requests").select("*,orders!inner(id,order_number,total,payment_method,payment_status,user_id,payment_transactions(id,provider_payment_id,status,livemode))").eq("id",returnId).single();
  if(returnError||!returnRequest)return json(request,{error:"Return request not found."},404);
  if(!["item_received","refund_processing"].includes(returnRequest.status))return json(request,{error:"Mark the returned item as received before refunding."},409);
  const order=Array.isArray(returnRequest.orders)?returnRequest.orders[0]:returnRequest.orders;
  if(order.payment_status==="refunded"||returnRequest.status==="refunded")return json(request,{refunded:true,reused:true});
  const transaction=Array.isArray(order.payment_transactions)?order.payment_transactions[0]:order.payment_transactions;
  await admin.from("return_requests").update({status:"refund_processing",reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",returnId);
  let refundId=`offline_refund_${crypto.randomUUID()}`,demo=order.payment_method==="cod"||!transaction?.livemode;
  let raw:Record<string,unknown>={offline:order.payment_method==="cod",demo};
  if(order.payment_method!=="cod"){
    if(!transaction?.provider_payment_id){await admin.from("return_requests").update({status:"item_received",admin_note:"Payment reference missing; refund not processed."}).eq("id",returnId);return json(request,{error:"PayMongo payment reference is missing."},409);}
    if(!demo){
      const response=await fetch("https://api.paymongo.com/v1/refunds",{method:"POST",headers:{Authorization:`Basic ${btoa(`${paymongo}:`)}`,"Content-Type":"application/json"},body:JSON.stringify({data:{attributes:{amount:Math.round(Number(order.total)*100),payment_id:transaction.provider_payment_id,reason:"requested_by_customer",notes:`Return ${returnRequest.return_number} for order ${order.order_number}`}}})});
      raw=await response.json();
      if(!response.ok){const message=(raw as any)?.errors?.[0]?.detail??"PayMongo rejected the refund.";await admin.from("return_requests").update({status:"item_received",admin_note:message}).eq("id",returnId);return json(request,{error:message},502);}
      refundId=String((raw as any)?.data?.id??"");
      if(!refundId)return json(request,{error:"PayMongo returned an incomplete refund."},502);
    }
  }
  const now=new Date().toISOString();
  const {error:finalError}=await admin.from("return_requests").update({status:"refunded",provider_refund_id:refundId,refunded_at:now,reviewed_by:user.id,reviewed_at:now}).eq("id",returnId);
  if(finalError)return json(request,{error:finalError.message},500);
  await admin.from("orders").update({payment_status:"refunded",refund_status:demo?"demo_succeeded":"succeeded",provider_refund_id:refundId,refunded_at:now}).eq("id",order.id);
  if(transaction?.id)await admin.from("payment_transactions").update({status:"refunded",raw_payload:raw,updated_at:now}).eq("id",transaction.id);
  return json(request,{refunded:true,demo,refundId});
});
