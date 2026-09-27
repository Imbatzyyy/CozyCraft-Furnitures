// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForecastPanel } from "./ForecastPanel";
const mocks = vi.hoisted(()=>({session:{workspaceReady:true,userId:"admin-a"},rpc:vi.fn()}));
vi.mock("@/app/core",()=>({money:(n:number)=>`PHP ${n.toFixed(2)}`,useAdminSession:()=>mocks.session}));
vi.mock("@/services/supabase/client",()=>({adminSupabase:{rpc:mocks.rpc}}));
vi.mock("recharts",()=>({Area:()=>null,Line:()=>null,XAxis:()=>null,YAxis:()=>null,Tooltip:()=>null,ResponsiveContainer:({children}:{children:React.ReactNode})=><>{children}</>,ComposedChart:()=> <div>Chart</div>}));
const data={version:2,generatedAt:"2026-09-27T00:00:00Z",through:"2026-09-26",timezone:"Asia/Manila",basis:"Actual",series:[],eligibleOrders:0,excludedTestPayments:76,undatedSettlements:0};
let root:Root, host:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal("Worker",undefined);mocks.session={workspaceReady:true,userId:"admin-a"};mocks.rpc.mockReset();mocks.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data,error:null})});host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
const render=()=>act(async()=>root.render(<ForecastPanel/>));
describe("forecast live loading lifecycle",()=>{
  it("loads a bounded authenticated summary on fresh admin entry without a refresh",async()=>{
    await render();expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("admin_forecast_inputs");
    expect(host.textContent).toContain("76 test payments excluded");
    expect(host.textContent).toContain("Building settlement history");
  });
  it("waits for staff readiness instead of showing fake zero reports",async()=>{
    mocks.session.workspaceReady=false;await render();expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.session={workspaceReady:true,userId:"admin-a"};await render();expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed responses and offers retry",async()=>{
    mocks.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:{series:[]},error:null})});await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("incomplete");
    expect(host.textContent).not.toContain("0 eligible settled orders");
  });
  it("ignores a late previous-account response",async()=>{
    let resolve!: (v:unknown)=>void;
    mocks.rpc.mockReturnValueOnce({abortSignal:()=>new Promise(r=>{resolve=r;})});
    await render();mocks.session={workspaceReady:true,userId:"admin-b"};await render();
    await act(async()=>resolve({data:{...data,excludedTestPayments:999},error:null}));
    expect(host.textContent).toContain("76 test payments excluded");expect(host.textContent).not.toContain("999");
  });
  it("refreshes after reconnect without polling or returning full orders",async()=>{
    vi.spyOn(document,"visibilityState","get").mockReturnValue("visible");await render();
    await act(async()=>window.dispatchEvent(new Event("online")));
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls.every(call=>call.length===1&&call[0]==="admin_forecast_inputs")).toBe(true);
  });
});
