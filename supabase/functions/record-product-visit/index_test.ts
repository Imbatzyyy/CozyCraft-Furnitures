import { strict as assert } from "node:assert";
import { handleProductVisit } from "./index.ts";
const origin="https://www.cozycraftfurnitures.com", base="https://fixture.supabase.co";
const payload={productId:"chair",eventId:"11111111-1111-4111-8111-111111111111"};
const req=(body:unknown=payload,headers:Record<string,string>={})=>new Request(base,{method:"POST",headers:{origin,"content-type":"application/json",...headers},body:JSON.stringify(body)});
Deno.test("product visits reject invalid origins, methods, IDs and oversized bodies",async()=>{
  assert.equal((await handleProductVisit(req(payload,{origin:"https://evil.invalid"}))).status,403);
  assert.equal((await handleProductVisit(new Request(base,{headers:{origin}}))).status,405);
  assert.equal((await handleProductVisit(new Request(base,{method:"OPTIONS",headers:{origin}}))).status,204);
  for(const body of [null,{...payload,productId:"../private"},{...payload,eventId:"bad"}]) assert.equal((await handleProductVisit(req(body))).status,400);
  assert.equal((await handleProductVisit(req({text:"x".repeat(2048)}))).status,413);
});
Deno.test("guests and accounts use the same private counter without storing identities",async()=>{
  Deno.env.set("SUPABASE_URL",base); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY","fixture-secret");
  const original=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async (url,options)=>{
    assert.ok(String(url).endsWith('/rpc/record_catalog_visit'));
    const body=JSON.parse(String(options?.body));
    assert.deepEqual(Object.keys(body).sort(),["p_event","p_product","p_source"]);
    assert.match(body.p_source,/^[0-9a-f]{64}$/); assert.ok(!JSON.stringify(body).includes("192.0.2.1"));
    calls++;
    return new Response(JSON.stringify({accepted:true,visits:42}),{headers:{"content-type":"application/json"}});
  };
  try {
    const cases: Record<string,string>[] = [{"x-forwarded-for":"192.0.2.1"},{"x-forwarded-for":"192.0.2.1",authorization:"Bearer account-token"}];
    for(const headers of cases) {
      const response=await handleProductVisit(req(payload,headers));
      assert.equal(response.status,200); assert.deepEqual(await response.json(),{accepted:true,visits:42});
    }
    assert.equal(calls,2);
    globalThis.fetch=async()=>new Response(JSON.stringify({message:"private failure"}),{status:500});
    const response=await handleProductVisit(req()); assert.equal(response.status,503);
    assert.ok(!(await response.text()).includes("private failure"));
  } finally { globalThis.fetch=original; }
});
