export type SyncedCartLine = { id: string; quantity: number; selectedForCheckout: boolean };
export type CartChange = { id: string; line: SyncedCartLine | null };
export type CartSyncState = { busy: boolean; error: string };

/** A single ordered writer. Rapid edits coalesce; failed edits remain retryable.
 * Read tokens reject snapshots started before a local mutation, including ones
 * that finish after its write. Account changes invalidate all old callbacks. */
export function createCartSync(
  write: (owner: string, changes: CartChange[]) => Promise<void>,
  changed: (state: CartSyncState) => void,
  settled: () => void,
  delay = 180,
) {
  let owner = "", epoch = 0, revision = 0, error = "";
  let pending = new Map<string, CartChange>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | null = null;
  const busy = () => Boolean(running || pending.size || timer);
  const notify = () => changed({ busy: busy(), error });
  const token = () => `${epoch}:${revision}`;
  const flush = async (): Promise<boolean> => {
    if (timer) { clearTimeout(timer); timer = undefined; }
    if (running) { await running; return error ? false : flush(); }
    if (!owner || !pending.size) { notify(); return !error; }
    error = "";
    const batch = [...pending.values()], requestEpoch = epoch, requestOwner = owner;
    pending.clear();
    running = Promise.resolve().then(() => write(requestOwner, batch)).catch(() => {
      if (epoch !== requestEpoch) return;
      // A newer local edit wins over the failed snapshot.
      for (const change of batch) if (!pending.has(change.id)) pending.set(change.id, change);
      error = "Your latest bag changes could not be saved. Retry before checking out.";
    }).finally(() => {
      if (epoch !== requestEpoch) return;
      running = null;
      notify();
    });
    notify();
    await running;
    if (epoch !== requestEpoch) return false;
    if (error) return false;
    if (pending.size) return flush();
    settled();
    return true;
  };
  return {
    token,
    invalidateReads: () => { revision++; },
    canRead: (started: string) => started === token() && !busy() && !error,
    hasPending: () => busy() || Boolean(error),
    setOwner(next: string | null) {
      if (owner === (next ?? "")) return;
      if (timer) clearTimeout(timer);
      owner = next ?? ""; epoch++; revision++; pending = new Map(); timer = undefined; running = null; error = "";
      notify();
    },
    enqueue(changes: CartChange[]) {
      if (!owner || !changes.length) return;
      revision++;
      for (const change of changes) pending.set(change.id, { id: change.id, line: change.line ? { ...change.line } : null });
      if (timer) clearTimeout(timer);
      // Explicit retry is required after a failure, so it cannot silently loop.
      if (!error) timer = setTimeout(() => { timer = undefined; void flush(); }, delay);
      notify();
    },
    flush,
  };
}
