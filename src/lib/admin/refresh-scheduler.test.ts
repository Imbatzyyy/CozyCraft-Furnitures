import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRefreshScheduler } from './refresh-scheduler';
afterEach(() => vi.useRealTimers());
describe('bounded realtime refresh', () => {
  it('does not starve during a continuous event stream', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    const scheduler = createRefreshScheduler(run);
    for (let i=0;i<30;i++) { scheduler.request(); await vi.advanceTimersByTimeAsync(100); }
    expect(run).toHaveBeenCalled();
    scheduler.dispose();
  });
  it('finishes the active request and coalesces a burst into one follow-up', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const run = vi.fn(() => new Promise<void>(resolve => { finish=resolve; }));
    const scheduler = createRefreshScheduler(run);
    scheduler.request(); await vi.advanceTimersByTimeAsync(500);
    for(let i=0;i<50;i++) scheduler.request();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(1);
    finish(); await vi.advanceTimersByTimeAsync(500);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.dispose(); finish();
  });
  it('does not start requests after disposal', async () => {
    vi.useFakeTimers(); const run=vi.fn(async()=>{});
    const scheduler=createRefreshScheduler(run);
    scheduler.request(); scheduler.dispose();
    await vi.advanceTimersByTimeAsync(5000); expect(run).not.toHaveBeenCalled();
  });
  it('reports a rejected read and continues with a queued invalidation',async()=>{
    vi.useFakeTimers();let reject!:(error:Error)=>void;
    const run=vi.fn().mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail;})).mockResolvedValue(undefined);
    const onError=vi.fn();const scheduler=createRefreshScheduler(run,100,500,onError);
    scheduler.request();await vi.advanceTimersByTimeAsync(100);scheduler.request();reject(new Error('offline'));
    await vi.advanceTimersByTimeAsync(100);expect(onError).toHaveBeenCalledOnce();expect(run).toHaveBeenCalledTimes(2);scheduler.dispose();
  });
});
