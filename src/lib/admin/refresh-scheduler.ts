// One request at a time, bounded debounce, and one queued follow-up.
export function createRefreshScheduler(run: () => Promise<void>, delay = 500, maxWait = 2000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let first = 0;
  let busy = false;
  let dirty = false;
  let disposed = false;
  const flush = async () => {
    timer = undefined;
    if (disposed || busy) return;
    dirty = false;
    first = 0;
    busy = true;
    try { await run(); }
    finally {
      busy = false;
      if (dirty && !disposed) timer = setTimeout(flush, delay);
    }
  };
  return {
    request() {
      if (disposed) return;
      if (!dirty) first = Date.now();
      dirty = true;
      if (busy) return;
      clearTimeout(timer);
      timer = setTimeout(flush, Math.max(0, Math.min(delay, maxWait - (Date.now() - first))));
    },
    dispose() { disposed = true; clearTimeout(timer); },
  };
}
