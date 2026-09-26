/** Explicit opt-in for read-only POST RPCs. Never apply to writes/payments. */
export async function withReadDeadline<T>(read: (signal: AbortSignal) => PromiseLike<T>, milliseconds = 12_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);
  try { return await read(controller.signal); }
  finally { clearTimeout(timeout); }
}
