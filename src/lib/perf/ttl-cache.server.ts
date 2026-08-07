/**
 * Tiny in-process TTL cache with single-flight (Wave 10).
 *
 * Used only for fully public, viewer-independent reads so cold and signed-out
 * traffic does not re-derive the same payload on every request. Per-isolate,
 * so it is a load smoother, not a correctness mechanism: a stale entry lives
 * at most `ttlMs`.
 */

type Entry<T> = { value: T; expiresAt: number };

const entries = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await fn();
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } catch (err) {
      // On failure, serve a stale entry when one exists rather than erroring.
      if (hit) return hit.value;
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/** Drop a cached entry (used by tests and by writes that must be visible now). */
export function invalidateCached(key: string): void {
  entries.delete(key);
}
