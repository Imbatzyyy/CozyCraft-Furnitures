// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchVisibleRecovery } from './visible-recovery';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe('visible read recovery',()=>{
  it('coalesces hidden invalidations until visible and avoids focus/visibility duplicate reads',()=>{
    vi.useFakeTimers();let visibility='hidden';
    vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility as DocumentVisibilityState);
    const read=vi.fn();const recovery=watchVisibleRecovery(read);
    for(let i=0;i<20;i++)recovery.invalidate();
    expect(read).not.toHaveBeenCalled();
    visibility='visible';document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));
    expect(read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30000);window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));
    expect(read).toHaveBeenCalledTimes(2);
    recovery.dispose();vi.advanceTimersByTime(30000);window.dispatchEvent(new Event('focus'));expect(read).toHaveBeenCalledTimes(2);
  });
  it('recovers a network reconnection without waiting for the focus TTL',()=>{
    vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
    const read=vi.fn();const recovery=watchVisibleRecovery(read);
    window.dispatchEvent(new Event('online'));expect(read).toHaveBeenCalledOnce();recovery.dispose();
  });
});
