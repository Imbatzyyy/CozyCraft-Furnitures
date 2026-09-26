import { describe, expect, it, vi } from 'vitest';
import { createReadCoordinator, createSerialReadQueue } from './read-coordinator';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
describe('read invalidation coordinator', () => {
  it('serializes snapshots and targeted patches without dropping either', async () => {
    const enqueue = createSerialReadQueue();
    const first = deferred<string>();
    const order: string[] = [];
    const snapshot = enqueue(async () => { order.push('snapshot'); return first.promise; });
    const patch = enqueue(async () => { order.push('patch'); throw new Error('offline'); });
    const recovery = enqueue(async () => { order.push('recovery'); return 'fresh'; });
    await Promise.resolve(); expect(order).toEqual(['snapshot']);
    first.resolve('old'); expect(await snapshot).toBe('old');
    await expect(patch).rejects.toThrow('offline');
    expect(await recovery).toBe('fresh');
    expect(order).toEqual(['snapshot','patch','recovery']);
  });
  it('re-reads after an event arrives during an older snapshot', async () => {
    const queue = createReadCoordinator<string>();
    const first = deferred<string>();
    const read = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('shipped');
    const pending = queue.run('customer:a:order:1', read);
    await Promise.resolve();
    for (let i = 0; i < 20; i++) expect(queue.run('customer:a:order:1', read)).toBe(pending);
    first.resolve('processing');
    expect(await pending).toBe('shipped');
    expect(read).toHaveBeenCalledTimes(2);
    expect(queue.has('customer:a:order:1')).toBe(false);
  });
  it('isolates identities and releases failures for a retry', async () => {
    const queue = createReadCoordinator<string>();
    const a = deferred<string>();
    const first = queue.run('a', () => a.promise);
    expect(await queue.run('b', async () => 'b')).toBe('b');
    a.resolve('a'); expect(await first).toBe('a');
    await expect(queue.run('a', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(await queue.run('a', async () => 'recovered')).toBe('recovered');
  });
  it('also drains an invalidation received during the follow-up', async () => {
    const queue = createReadCoordinator<number>();
    const second = deferred<number>();
    const read = vi.fn().mockResolvedValueOnce(1).mockReturnValueOnce(second.promise).mockResolvedValue(3);
    const request = queue.run('a', read);
    queue.run('a', read);
    await Promise.resolve();
    queue.run('a', read);
    await Promise.resolve(); await Promise.resolve();
    queue.run('a', read); second.resolve(2);
    expect(await request).toBe(3);
  });
});
