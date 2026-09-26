/** Coalesce reads without losing invalidations received while a read is running.
 * Each identity/resource has its own queue. Callers await the final, fresh read.
 * Never use this for writes: repeating a mutation is not safe.
 */
export function createReadCoordinator<T>() {
  type Entry = { dirty: boolean; read: () => Promise<T>; promise: Promise<T> };
  const pending = new Map<string, Entry>();
  return {
    has: (key: string) => pending.has(key),
    current: (key: string) => pending.get(key)?.promise,
    run(key: string, read: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);
      if (existing) {
        existing.dirty = true;
        existing.read = read;
        return existing.promise;
      }
      const entry: Entry = { dirty: false, read, promise: undefined! };
      // Defer execution until the entry is registered, including synchronous
      // failures and re-entrant invalidations from a mocked/cache-backed read.
      entry.promise = Promise.resolve().then(async () => {
        try {
          let result: T;
          do {
            entry.dirty = false;
            try { result = await entry.read(); }
            catch (error) { if (!entry.dirty) throw error; }
          } while (entry.dirty);
          return result!;
        } finally {
          if (pending.get(key) === entry) pending.delete(key);
        }
      });
      pending.set(key, entry);
      return entry.promise;
    },
  };
}

/** Serialize different read jobs that publish into the same snapshot. Unlike
 * the coordinator, this does not replace jobs with the newest callback. */
export function createSerialReadQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(read: () => Promise<T>): Promise<T> => {
    const next = tail.then(read, read);
    tail = next.catch(() => undefined);
    return next;
  };
}
