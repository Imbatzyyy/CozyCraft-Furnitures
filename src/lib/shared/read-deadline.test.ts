import { afterEach, expect, it, vi } from 'vitest';
import { withReadDeadline } from './read-deadline';
afterEach(()=>vi.useRealTimers());
it('aborts a stalled read and clears the deadline after completion',async()=>{
  vi.useFakeTimers();
  const stalled=withReadDeadline(signal=>new Promise(resolve=>signal.addEventListener('abort',()=>resolve('aborted'))),100);
  await vi.advanceTimersByTimeAsync(100);expect(await stalled).toBe('aborted');
  let captured!:AbortSignal;
  expect(await withReadDeadline(async signal=>{captured=signal;return 'ok';},100)).toBe('ok');
  await vi.advanceTimersByTimeAsync(1000);expect(captured.aborted).toBe(false);
});
