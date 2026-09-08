import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({from:vi.fn(),rpc:vi.fn()}));
vi.mock("@/services/supabase/client", () => ({supabase:mocks}));
import { loadHomeCircle } from "./home-circle.service";
const account={points_balance:123,tier:"plus",lifetime_eligible_spend:19000,tier_valid_until:null};
function query(data: unknown, error: unknown = null) {
  const q: Record<string, any> = {};
  for (const name of ["select","eq","gt","order","limit","abortSignal"]) q[name]=vi.fn(()=>q);
  q.maybeSingle=vi.fn(async()=>({data,error}));
  q.then=(resolve: (value:unknown)=>unknown)=>Promise.resolve({data,error}).then(resolve);
  return q;
}
describe("Home Circle bounded authenticated reads",()=>{
  beforeEach(()=>vi.resetAllMocks());
  it("filters every table to the account and bounds both lists without recalculating",async()=>{
    const qs=[query(account),query([]),query([])];qs.forEach(q=>mocks.from.mockReturnValueOnce(q));
    const result=await loadHomeCircle("customer-a",new AbortController().signal);
    expect(result.account.points_balance).toBe(123);
    for(const q of qs)expect(q.eq).toHaveBeenCalledWith("user_id","customer-a");
    expect(qs[1].limit).toHaveBeenCalledWith(20);expect(qs[2].limit).toHaveBeenCalledWith(20);
    expect(qs[2].eq).toHaveBeenCalledWith("status","available");expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("initializes only a missing account through the authenticated existing RPC",async()=>{
    mocks.from.mockReturnValueOnce(query(null)).mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
    mocks.rpc.mockReturnValue(query(account));
    expect((await loadHomeCircle("customer-a",new AbortController().signal)).account).toEqual(account);
    expect(mocks.rpc).toHaveBeenCalledWith("get_mobile_loyalty");
  });
  it("surfaces access failures rather than inventing a zero balance",async()=>{
    mocks.from.mockReturnValue(query(null,new Error("denied")));
    await expect(loadHomeCircle("customer-a",new AbortController().signal)).rejects.toThrow("denied");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
