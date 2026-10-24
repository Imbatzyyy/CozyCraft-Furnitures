import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/services/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));
vi.mock("@/lib/shared/read-deadline", () => ({ withReadDeadline: (run: (s: AbortSignal) => unknown) => run(new AbortController().signal) }));
const rows = (visits = 8) => ({ data: [{product_id:"chair",visits,saves:999}], error:null });
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); mock.rpc.mockReset(); mock.rpc.mockImplementation(() => ({abortSignal:()=>Promise.resolve(rows())})); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("guest-inclusive popularity", () => {
  it("deduplicates concurrent aggregate reads, caches and expires them", async () => {
    const service = await import("./popularity.service");
    await Promise.all([service.getCatalogPopularity(),service.getCatalogPopularity()]);
    await service.getCatalogPopularity();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith("catalog_visit_counts");
    expect(service.cachedProductPopularity("chair").popularity).toBe(8);
    vi.advanceTimersByTime(60001); await service.getCatalogPopularity();
    expect(mock.rpc).toHaveBeenCalledTimes(2);
  });
  it("records guests without a bearer token, limits repeats, and refreshes the rank", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({accepted:true,visits:9})));
    vi.stubGlobal("fetch", fetcher);
    const service = await import("./popularity.service");
    await service.getCatalogPopularity();
    const subscriber=vi.fn(); service.subscribeCatalogPopularity(subscriber);
    await Promise.all([service.recordProductVisit("chair"),service.recordProductVisit("chair")]);
    await service.recordProductVisit("chair");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const request=fetcher.mock.calls[0][1];
    expect(request.headers).not.toHaveProperty("Authorization");
    expect(request.credentials).toBe("omit");
    expect(Object.keys(JSON.parse(request.body)).sort()).toEqual(["eventId","productId"]);
    expect(service.cachedProductPopularity("chair").popularity).toBe(9);
    expect(subscriber).toHaveBeenCalled();
    await service.getCatalogPopularity(); expect(mock.rpc).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30*60000+1);
    fetcher.mockResolvedValue(new Response(JSON.stringify({accepted:true,visits:10})));
    await service.recordProductVisit("chair"); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("reuses retry IDs after failures and retains counts during a read outage", async () => {
    const fetcher=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(new Response(JSON.stringify({accepted:false})));
    vi.stubGlobal("fetch",fetcher);
    const service=await import("./popularity.service");
    await service.getCatalogPopularity();
    await service.recordProductVisit("chair"); await service.recordProductVisit("chair");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).eventId).toBe(JSON.parse(fetcher.mock.calls[1][1].body).eventId);
    mock.rpc.mockImplementation(()=>({abortSignal:()=>Promise.resolve({data:null,error:{message:"offline"}})}));
    await service.getCatalogPopularity();
    expect(service.cachedProductPopularity("chair").popularity).toBe(8);
  });
  it("does not overwrite a visit accepted while a slower aggregate read is in flight", async () => {
    let resolve!: (data: ReturnType<typeof rows>)=>void;
    mock.rpc.mockImplementation(()=>({abortSignal:()=>new Promise(r=>{resolve=r;})}));
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({accepted:true,visits:20}))));
    const service=await import("./popularity.service");
    const read=service.getCatalogPopularity();
    await service.recordProductVisit("chair"); resolve(rows(8)); await read;
    expect(service.cachedProductPopularity("chair").popularity).toBe(20);
  });
});
