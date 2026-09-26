/** Focus/visibility/online can fire together. Recover once, and never poll. */
export function watchVisibleRecovery(recover: () => void, staleAfter = 30_000) {
  let last = Date.now();
  let dirty = false;
  const check = () => {
    if (document.visibilityState === 'hidden') return;
    if (dirty || Date.now() - last >= staleAfter) {
      dirty = false;
      last = Date.now();
      recover();
    }
  };
  const invalidate = () => { dirty = true; check(); };
  window.addEventListener('focus', check);
  window.addEventListener('online', invalidate);
  document.addEventListener('visibilitychange', check);
  return {
    invalidate,
    dispose() {
      window.removeEventListener('focus', check);
      window.removeEventListener('online', invalidate);
      document.removeEventListener('visibilitychange', check);
    },
  };
}
