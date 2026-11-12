import assert from "node:assert/strict";

Deno.test("web customer completes multipart support and return submissions with caller-scoped storage and database writes", async () => {
  const origFetch = globalThis.fetch, origServe = Deno.serve;
  const old = [Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_ANON_KEY")];
  const user = "00000000-0000-4000-8000-000000000001", order = "00000000-0000-4000-8000-000000000002";
  let handle!: (r: Request) => Promise<Response>;
  let submitted: Record<string,unknown> = {}, writes = 0;
  try {
    Deno.env.set("SUPABASE_URL","https://fixture.invalid"); Deno.env.set("SUPABASE_ANON_KEY","fixture-public");
    Deno.serve = ((fn: typeof handle) => { handle = fn; }) as typeof Deno.serve;
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-user");
      if (url.pathname.endsWith("/rpc/security_action_allowed")) return Response.json(true);
      if (url.pathname === "/auth/v1/user") return Response.json({id:user});
      if (url.pathname === "/rest/v1/orders") {
        assert.equal(url.searchParams.get("user_id"),"eq."+user);
        return Response.json([{status:"delivered"}]);
      }
      if (url.pathname.startsWith("/storage/v1/object/")) {
        assert.ok(url.pathname.includes("/"+user+"/")); writes++;
        return Response.json({Key:"fixture"});
      }
      if (["/rest/v1/support_tickets","/rest/v1/return_requests"].includes(url.pathname)) {
        submitted=JSON.parse(String(init?.body));return new Response(null,{status:201});
      }
      throw Error("Unexpected fixture endpoint "+url.pathname);
    };
    await import("./index.ts");
    const headers = {Authorization:"Bearer fixture-user", Origin:"https://cozycraftfurnitures.com"};
    const preflight=await handle(new Request("https://local.invalid",{method:"OPTIONS",headers}));
    assert.ok(preflight.headers.get("Access-Control-Allow-Headers")?.includes("x-cozycraft-platform"));
    for (const kind of ["support","return"]) {
      const form=new FormData();
      for (const [key,value] of Object.entries({kind,message:"Please review this item.",category:"order",priority:"normal",reason:"Damaged",order})) form.set(key,value);
      form.append("file", new File([new Uint8Array([137,80,78,71,13,10,26,10])],"example.png",{type:"image/png"}));
      const r=await handle(new Request("https://local.invalid",{method:"POST",headers,body:form}));
      assert.equal(r.status,200,await r.text());
      assert.equal(submitted.user_id,user); assert.equal(submitted.order_id,order);
      const paths = submitted[kind==="support"?"attachment_paths":"evidence_paths"] as string[];
      assert.equal(paths.length,1); assert.ok(paths[0].startsWith(user+"/"));
    }
    assert.equal(writes,2);
  } finally {
    Deno.serve=origServe;globalThis.fetch=origFetch;
    for (const [i,k] of ["SUPABASE_URL","SUPABASE_ANON_KEY"].entries()) if(old[i]===undefined) Deno.env.delete(k); else Deno.env.set(k,old[i]!);
  }
});
