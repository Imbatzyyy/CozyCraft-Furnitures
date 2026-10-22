import { afterEach, describe, expect, it, vi } from "vitest";
import { createCartSync, type CartChange } from "./cart-sync";
const line = (quantity: number) => ({ id: "chair", line: { id: "chair", quantity, selectedForCheckout: true } });
afterEach(() => vi.useRealTimers());
describe("ordered cart synchronization", () => {
  it("coalesces rapid clicks into a single latest-value write", async () => {
    vi.useFakeTimers();
    const write = vi.fn(async () => {}), state = vi.fn();
    const sync = createCartSync(write, state, vi.fn());
    sync.setOwner("owner");
    for(let n=1;n<=50;n++) sync.enqueue([line(n)]);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(180);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("owner", [line(50)]);
    expect(state).toHaveBeenLastCalledWith({busy:false,error:""});
  });
  it("never overlaps writes and rejects stale reads even after writes finish", async () => {
    let finish: () => void = () => {};
    const batches: CartChange[][] = [];
    const write = vi.fn((_owner: string, changes: CartChange[]) => { batches.push(changes); return new Promise<void>(resolve => {finish=resolve;}); });
    const sync=createCartSync(write,vi.fn(),vi.fn()); sync.setOwner("owner");
    const before=sync.token(); sync.enqueue([line(11)]); const first=sync.flush();
    await Promise.resolve(); sync.enqueue([line(12)]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(sync.canRead(before)).toBe(false);
    finish(); await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(batches).toEqual([[line(11)],[line(12)]]);
    finish(); await first;
    expect(sync.canRead(before)).toBe(false);
    expect(sync.canRead(sync.token())).toBe(true);
  });
  it("keeps failed changes, blocks checkout, and retries the newest intent", async () => {
    const write=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const sync=createCartSync(write,vi.fn(),vi.fn()); sync.setOwner("owner");
    sync.enqueue([line(2)]); expect(await sync.flush()).toBe(false);
    expect(sync.hasPending()).toBe(true);
    expect(sync.canRead(sync.token())).toBe(false);
    sync.enqueue([line(3)]); expect(await sync.flush()).toBe(true);
    expect(write).toHaveBeenLastCalledWith("owner",[line(3)]);
  });
  it("coalesces add/remove and selection changes without resurrecting a row", async () => {
    const write=vi.fn(async()=>{}), sync=createCartSync(write,vi.fn(),vi.fn());sync.setOwner("owner");
    sync.enqueue([line(4)]);sync.enqueue([{id:"chair",line:null}]);await sync.flush();
    expect(write).toHaveBeenLastCalledWith("owner",[{id:"chair",line:null}]);
  });
  it("ignores a prior account's in-flight failures and callbacks", async () => {
    let fail: (error: Error) => void = () => {};
    const write=vi.fn().mockImplementationOnce(()=>new Promise<void>((_,reject)=>{fail=reject;})).mockResolvedValue(undefined);
    const state=vi.fn(),settled=vi.fn(),sync=createCartSync(write,state,settled);
    sync.setOwner("first");sync.enqueue([line(1)]);const pending=sync.flush();await Promise.resolve();
    sync.setOwner("second");sync.enqueue([line(2)]);await sync.flush();
    fail(new Error("old account"));await pending;
    expect(sync.hasPending()).toBe(false);
    expect(state).toHaveBeenLastCalledWith({busy:false,error:""});
    expect(settled).toHaveBeenCalledTimes(1);
  });
});
